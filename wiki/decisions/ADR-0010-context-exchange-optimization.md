---
type: adr
status: ACCEPTED
date: 2026-07-05
tags:
  [
    adr,
    storage,
    indexing,
    context-exchange,
    tokens,
    handoff,
    grill,
    performance,
    scale,
  ]
aliases: [ADR-0010, ADR-0010-context-exchange-optimization, Feature-580]
---

# ADR-0010 — Context-Exchange Optimization: Indexed Reads, Content-Addressed State, Delta Handoff, Runtime Grill

## Status

ACCEPTED — 2026-07-05. Builds on [[ADR-0001-architecture-foundation]] (Storage
seam), [[ADR-0008-deployment-storage-topology]] (the config-selected adapter
pattern and the Postgres/`seq` topology), and the state-first design principle in
[[specs]] §4.1. Implementation is **staged**; this ADR records the direction so
parallel work sequences against it. Slices 1–3 (the scale tier) are approved to
start first.

**Implemented (2026-07-10) — resume packet as a bounded global workspace (B4).**
`GET /v1/work/:id/resume` now carries a stable `sha256` `ETag` and answers a
matching `If-None-Match` with `304 Not Modified` (write-once-read-many), and an
opt-in `?budget=N` returns a salience-ranked view that inlines the N most-recent
artifacts/reviews and elides the rest to `{ count, ids }` references. The pure
[[resume-workspace]] module carries the shaping and the correctness guard that
pins gate-critical reviews, so a budgeted packet can never flip the merge gate.
This is the transport-level slice of B4; the content-addressed [[Blob]] store and
delta [[Handoff]] record remain the deeper, still-staged wins.

This ADR is the comprehensive technical design for **Feature 580 — Optimize ACP
for Multi-Agent Context Exchange**. It is organized to answer, in order: what the
current system does, where it bottlenecks, how many tokens that costs, and the
architecture that fixes it.

## Context

### What ACP is, and the constraint it imposes

ACP is a **state-first coordination host** ([[specs]] §4.1: "Agents do not
coordinate by sending casual messages. They coordinate by publishing state
changes."). Agents never share LLM context; they exchange durable,
workspace-scoped records — [[WorkUnit]], [[Lease]], [[Artifact]], [[Checkpoint]],
[[Memory]], [[Review]], [[Event]] — through one [[Storage]] port with three
adapters (InMemory, SQLite, Postgres). Feature 580 must **stay inside** this
model: every optimization below is references, deltas, and immutable snapshots.
Nothing introduces conversation transfer, and the [[specs]] non-goals ("not a
memory database", "state-first, not message-first") remain in force. The wins come
from the fact that the right primitives already exist — [[Memory]] refs,
[[Checkpoint]]s, the `WorkResumePacket`, the append-only [[Event]] log with a
monotonic per-workspace `seq` — but are **inlined, unindexed, and
un-deduplicated**.

### Current implementation (as of 2026-07-05)

The [[Storage]] port ([[storage]]) is a generic keyed store. All ten domain
entities persist into a single `kv(collection, id, value)` table via
`put`/`get`/`list`/`remove`, keyed only by `(collection, id)`. Two entities have
dedicated append-only tables — `events` and `memory` — with a monotonic
per-workspace `seq` and, for `memory`, two composite indexes
(`(workspace_id, key, seq)`, `(workspace_id, work_id, seq)`). Records serialize as
JSON via Effect `Schema.encode`. Artifact _content_ is already split into a lazy
`artifact_content` collection (metadata vs. blob), which is the one place the
"reference, fetch on demand" pattern already exists.

## Bottlenecks (verified against source)

**B1 — Every scoped read is a full-collection scan + full decode + in-app
filter.** `WorkUnitService.listForWorkspace` (`work-unit-service.ts:200`) calls
`storage.list('work')` — which is `SELECT value FROM kv WHERE collection = 'work'
ORDER BY id` (`postgres-store.ts`), _no `workspace_id` predicate_ — then
`Schema.decodeUnknown`s **every** row across **every** workspace and filters
`w.workspace_id === x` in JavaScript. `ArtifactService.listForWork`/`listForWorkspace`
(`artifact-service.ts:245-259`) do the same. The recently added
`--state`/`--priority`/`--assigned-to`/`--holder`/`--kind` filters are all
**client-side** on top of the full scan. The `kv` table has **zero** secondary
indexes. This is O(N_all) rows decoded per list and is the primary scale ceiling.

**B2 — Whole-object rewrite and full-blob compare-and-swap.** `put` rewrites the
entire `value` blob on every mutation. `replaceIf` (the optimistic-concurrency
primitive used by work-unit transitions and lease acquisition) executes
`UPDATE kv SET value = ? WHERE collection = ? AND id = ? AND value = ?` — it
compares the **entire serialized object** for CAS. This ships and compares a full
blob for every guarded write and couples correctness to canonical-JSON equality.

**B3 — No content-addressing, no deduplication.** No hashing exists anywhere in
`src/` (`grep` for `sha`/`createHash`: no matches). Artifact content, memory
content, and checkpoint step-lists are stored verbatim, repeatedly. Storage and
transfer grow O(total), not O(unique). Deep handoff chains re-store and re-send
identical bytes.

**B4 — Handoff/resume inlines the full accumulated state (the token offender).**
`getWorkResumePacket` (`resume-routes.ts:45`) returns the full [[WorkUnit]] + the
latest [[Checkpoint]] + **all** [[Artifact]]s + **all** [[Review]]s. There is no
"since" cursor and no delta. A chain of N handoffs re-transfers the growing total
each time.

**B5 — `grill` does not exist at runtime.** It is only an FMCF _methodology_ term
(SKILL.md §VI: agent self-interrogation) and dev-log notes. There is no
agent-to-agent challenge protocol, so adversarial verification between workers
would route through the human.

**B6 — Memory recall is index/cursor only.** `readMemory` filters by
`workspace_id`/`seq`/`key`/`work_id` with `kind`/`label` applied in-app. There is
no relevance retrieval and no size discipline on `content`. At scale, recall
over-returns (tokens) or misses relevant records (accuracy).

## Token-usage analysis

The tokens that cross an agent boundary are exactly what a handed-off or incoming
agent must fetch to continue: the resume/handoff payload, memory recall, and
artifact content. Growth is driven by **B3** (no dedup → repeated content re-sent)
and **B4** (no delta → each handoff re-sends the full state). B1/B2 are CPU/IO/
latency, not tokens — but they cap how many agents can run concurrently.

Model a linear handoff chain of depth `N`, where by step `k` the work has
accumulated `a·k` artifact/review records (metadata) of average size `s`:

- **Today:** step `k` transfers the full packet ≈ `a·k·s`. Total across the chain
  = `a·s·Σk` = **Θ(a·s·N²)**. Content bytes are re-sent every step (no ETag, no
  dedup).
- **Proposed (delta + content-addressed refs):** step `k` transfers only the
  `Δ ≈ a` new refs plus already-held refs elided by hash → **Θ(a·s·N)** total, and
  the _bytes_ behind unchanged refs are transferred **once** over the whole chain.

So the headline is **O(N²) → O(N)** in handoff-chain tokens, and repeated content
collapses from O(total) to O(unique). Memory recall goes from an O(window) scan to
**O(K)** relevant records under semantic retrieval.

## Decision

Seven moves, behind the existing [[Storage]] `Context.Tag` wherever possible so the
domain services and the three-adapter topology from [[ADR-0008]] are preserved.
Grouped as the **scale tier** (A, B, index reads — slices 1–3, approved first) and
the **token tier** (C–G).

### A. Queryable, indexed Storage port — kill the full scans (fixes B1)

Extend `StorageApi` with a predicate-aware read:

```
query(collection, filters: ReadonlyArray<{ field: string; value: string }>,
      opts?: { limit?: number; after?: string }): Chunk<unknown>
```

Back it with **real indexes on promoted scoping columns**. Keep the single generic
`kv` table (no per-entity table sprawl); add indexed columns for the hot fields the
domain already filters on: `workspace_id`, `work_id`, `state`, `assigned_to`,
`priority`, `holder`, `kind`.

- **Postgres:** `GENERATED ALWAYS AS (value->>'workspace_id') STORED` columns +
  composite B-tree indexes (`(collection, workspace_id)`,
  `(collection, workspace_id, state)`, …). The planner uses table statistics;
  writes stay single-statement.
- **SQLite / InMemory (full parity except semantic):** real columns populated on
  write from the decoded record + the same composite indexes; InMemory maintains
  per-collection secondary maps. No behavioural gap versus Postgres for indexing or
  dedup — only pgvector semantic recall (move F) is Postgres-only, negotiated via
  capabilities.

Domain services replace `list(collection).filter(...)` with
`query(collection, [{field:'workspace_id', value}], ...)`. Result: workspace/work
lists go from O(N_all) decode to **O(log N + k)** (k = matching rows). At 1M rows
across 10 workspaces this is ~5 orders of magnitude fewer rows decoded per list.
`list` is retained only for genuine full-collection needs (e.g. the sweeper) and
is documented as such.

### B. Version column for O(1) CAS (fixes B2)

Add a monotonic `version bigint` to `kv` rows. `replaceIf` becomes
`WHERE collection = ? AND id = ? AND version = ?` and bumps `version`. This is an
O(1) integer compare, removes the full-blob transfer on guarded writes, and drops
the dependency on canonical-JSON equality. The full-blob path is retained until all
call sites (work transitions, lease acquisition) are migrated behind version CAS
with tests, then removed.

### C. Content-addressed blob store (fixes B3)

New content-addressed store: `blobs(hash PRIMARY KEY, bytes, refcount, created_at)`
where `hash = sha256(bytes)`. Artifact content, oversized memory content, and
checkpoint payloads reference `blob://sha256-<hex>`. Writing identical content
twice increments `refcount` and stores bytes once; agents exchange the 32-byte hash
and fetch on demand. Blobs are immutable, so they are trivially cacheable
(ETag = hash) and infinitely shareable across workspaces and handoffs. A blob is
garbage-collected when `refcount` reaches 0 (swept alongside event retention,
[[ADR-0008]] operational contract). `artifact_content` migrates onto `blobs` while
the `acp://artifacts/{id}` URI stays stable for compatibility.

### D. Handoff as an immutable snapshot + delta cursor (fixes B4 — the token win)

Productize FMCF's `handoff` at the runtime layer. A **Handoff** is an immutable
record capturing **references, not payloads**:

```
Handoff {
  id, work_id, workspace_id, from: WorkerId, to?: WorkerId,
  at_seq,                       -- event-log high-water-mark at capture
  checkpoint_ref?, context_refs: BlobRef[] , memory_keys: string[],
  since?: HandoffId,            -- prior handoff this one deltas from
  digest,                       -- content hash of the ref-set (ETag)
  created_at
}
```

The receiver fetches the (tiny) handoff, then **lazily** pulls only the refs it
does not already hold; because refs are content-addressed, anything the receiver
has already seen (same hash) is skipped. `acp handoff --since <prior>` computes the
event/artifact/memory delta since the prior handoff's `at_seq`, so each step
transfers Θ(Δ), not Θ(total). The resume packet is **materialized once at handoff
creation** (immutable, cacheable) rather than re-assembled per read. The human is
never the channel: `acp handoff` writes the record and emits a `work.handoff`
[[Event]]; the receiving sub-agent reads it directly. A new `handoff:create` /
`handoff:read` permission pair gates it.

### E. Runtime `grill` — structured adversarial exchange between workers (fixes B5)

Productize FMCF's `grillme` at the runtime layer as a **bounded, agent-to-agent
challenge loop** built on typed events + memory — no human relay, no conversation
transfer. A grill session against a [[WorkUnit]]:

1. The grilling worker posts challenge tuples `{ claim_ref, question }` (as
   `memory kind=grill` or a dedicated typed record + `grill.challenged` event).
2. The grilled worker replies with `{ question_ref, answer_summary, evidence_refs }`
   pointing at artifacts/checkpoints as evidence (`grill.answered` event).
3. The loop terminates on `resolved` or `max_rounds` (bounded to prevent runaway
   token spend), emitting `grill.resolved`.

Only challenge/response **refs** cross the wire. The full transcript is
reconstructable from the log for a human, but agents exchange minimal tuples. This
mirrors the FMCF grill scoring order (correctness > simplicity > convention-fit >
reversibility > performance), now executed between workers instead of within one.

### F. Semantic + cursor hybrid memory recall (fixes B6)

Keep the exact cursor/key/label index as the **deterministic default**. Add an
**opt-in** `readMemory({ similar_to, k })` mode via pgvector on Postgres: store an
embedding alongside each memory row and retrieve the top-K relevant records by
cosine, so an incoming agent pulls the _relevant_ K instead of replaying the
window. Opt-in preserves determinism and vendor-neutrality — it is negotiated at
session initialize as a `supports_semantic_recall` capability; SQLite/InMemory
degrade to keyword/label recall and advertise the gap. This is the only capability
where SQLite is not at parity. Memory content gains a soft size budget; content
over budget spills to a `blob://` ref (move C) with the inline `summary` retained
for cheap scanning.

### G. Reusable Context Blocks + ETag caching (kills repeated system prompts)

A **ContextBlock** is a named, immutable, content-addressed text block (task brief,
coding standards, workspace constraints) referenced by hash across agents and
sessions. Repeated system prompts and boilerplate collapse to **one stored block +
a ref**; the block is fetched once and cached forever (immutable). Add HTTP
`ETag`/`If-None-Match` on blob, handoff, resume, and context-block reads → `304 Not
Modified` with no body when the agent already holds the version. Add a small
in-process LRU on decoded hot records keyed by `(id, version)`, invalidated by the
version bump from move B.

## Indexing strategy (summary)

| Table     | Key / index                                                | Serves                                                         |
| --------- | ---------------------------------------------------------- | -------------------------------------------------------------- |
| `kv`      | PK `(collection, id)`; `version` col                       | point get, O(1) CAS                                            |
| `kv`      | `(collection, workspace_id)` + per-hot-field composites    | move A scoped lists                                            |
| `events`  | PK `(workspace_id, seq)`                                   | replay range scan (unchanged)                                  |
| `memory`  | `(workspace_id, key, seq)`, `(workspace_id, work_id, seq)` | recall (unchanged); + optional `ivfflat` vector index (move F) |
| `blobs`   | PK `hash`; partial index `refcount=0`                      | dedup lookup, GC sweep                                         |
| `handoff` | `(work_id, at_seq)`                                        | latest/delta handoff                                           |

## Retrieval strategy

Two tiers, both reference-first. **Deterministic (default):** point-get by id, and
`query`/`readMemory` by indexed predicate + `seq` cursor — exact, reproducible,
adapter-portable. **Semantic (opt-in, Postgres):** top-K by embedding for recall
where relevance beats recency. Large payloads are never inlined into a list result:
lists return metadata + `blob://` refs; bytes are fetched on demand and cached by
hash.

## Caching strategy

Immutability makes caching correct by construction. Content-addressed blobs,
handoffs, and context blocks are cached by hash (ETag), yielding `304`/`ref`
responses on repeat pulls (~0 tokens). Mutable records (work units, latest
checkpoint) use an in-process `(id, version)` LRU invalidated by version bump. No
distributed cache is introduced — the Postgres/pg-notify topology from
[[ADR-0008]] already provides cross-replica correctness; caching is per-replica and
version-guarded.

## Complexity analysis (time / space)

| Operation                | Today                      | Proposed                 |
| ------------------------ | -------------------------- | ------------------------ |
| Scoped list              | O(N_all) scan + decode     | **O(log N + k)** time    |
| Guarded write (CAS)      | O(blob) transfer + compare | **O(1)** version compare |
| Repeated-content storage | O(total) space             | **O(unique)** space      |
| Handoff-chain tokens     | Θ(a·s·N²)                  | **Θ(a·s·N)**, bytes once |
| Memory recall tokens     | O(window)                  | **O(K)** semantic        |
| Repeated content pull    | O(bytes)                   | **O(1)** (304 / ref)     |

## Trade-offs

- Generated columns and dedup add per-write cost (hashing, index maintenance):
  bounded, single-statement, paid once per write, amortized across many reads.
- Semantic retrieval adds nondeterminism and an embedding dependency → strictly
  opt-in with a deterministic default; never on the critical path.
- Content-addressed blobs add refcount + GC bookkeeping → folded into the existing
  retention sweep; a leaked blob wastes space but is never incorrect.
- A queryable port is a wider seam than a blind `list`; justified by measurable
  read-cost collapse and by removing the client-side-filter anti-pattern the recent
  `--state`/`--holder`/`--kind` commits accreted.

## Migration plan (FMCF slices — wiki-first, one branch/PR each)

Each slice authors its wiki page(s) first (Step 3), projects code (Step 4),
verifies (Step 5), and closes the loop (Step 6). Independently shippable and
reversible.

**Scale tier (approved first):**

1. This ADR + [[Storage]] seam update: queryable port & indexing direction.
2. `version` column + CAS-by-version (additive, backward-compatible; keep full-blob
   path until cut over).
3. Generated/indexed columns + `query()` port method; migrate all `listFor*` to
   indexed predicates; retain `list` only for full-scan consumers.

**Token tier:** 4. Content-addressed `blobs` + refcount + GC; migrate `artifact_content`; keep
`acp://` URI compatibility. 5. `ContextBlock` primitive + ETag/`If-None-Match` + decode LRU. 6. `Handoff` record + `acp handoff` + `--since` delta + materialized resume;
`handoff.*` events + permissions. 7. `acp grill` adversarial protocol (typed records + `grill.*` events + bounded
rounds). 8. Opt-in semantic recall (pgvector) behind `supports_semantic_recall` capability.

## Risks

- **Auto-schema has no migration tool.** [[ADR-0008]] noted a `@effect/sql`
  migrator is planned but unstarted; today schema is `CREATE TABLE IF NOT EXISTS`
  applied on boot. Adding columns to live `kv`/`memory` needs an **additive
  migration + backfill** for existing deployments. This is the biggest structural
  risk and gates slices 2–3; the migrator work may need to land first.
- **Adapter parity.** Generated columns (Postgres) vs. real-column-on-write
  (SQLite/InMemory) must produce identical `query` results — covered by a shared
  adapter conformance suite (extend `*-store.test.ts`).
- **Full-blob CAS is load-bearing** in lease/work services — migrate behind version
  CAS with tests before removing.
- **Determinism vs. semantic recall** — mitigated by opt-in + capability
  negotiation; the default path stays exact.

## Consequences

The [[Storage]] seam's capacity rises (a queryable port is a larger contract than
`list`); it moves toward BACKBONE and its page is updated accordingly. Domain
services shrink (client-side filters deleted). New domain concepts —
[[Blob]]/content-addressing, `Handoff`, `Grill`, `ContextBlock` — get domain pages
as their slices land. Nothing changes for `local` developers by default: indexing
and dedup are transparent; handoff/grill/semantic are additive capabilities. The
[[specs]] non-goals hold: no conversation transfer, no chat bus, no general memory
DB — only tighter, reference-first coordination state.

## Alternatives

- **Per-entity tables instead of indexed generic `kv`** — rejected as the default:
  cleaner planner stats but multiplies migration surface and breaks the generic
  port that all ten services and three adapters share. Revisit only if a single
  collection develops query needs the generic columns cannot serve.
- **External vector DB / search service for recall** — rejected: adds a second
  stateful dependency against [[ADR-0008]]'s "Postgres-only production surface"
  principle. pgvector keeps recall inside the existing database.
- **Compress payloads (gzip) instead of dedup + refs** — rejected as primary:
  compression shrinks a re-sent blob but still re-sends it; content-addressing
  removes the transfer entirely. Compression is a complementary transport concern,
  not an architecture.
- **Keep resume assembling live per read, just paginate** — rejected: pagination
  caps a single response but not the O(N²) chain; the immutable materialized
  snapshot + delta is what bounds chain growth.

## Grill Log

- **Q:** Generic indexed `kv` or per-entity tables?
  **A:** Generic `kv` with promoted generated/indexed columns. _Rationale:_ preserves
  the single stable [[Storage]] contract that ten services and three adapters share
  (convention-fit, reversibility); the O(log N) win comes from the index, not the
  table split. _Rejected:_ per-entity tables (better stats, far larger migration +
  contract surface for marginal gain today).
- **Q:** How is optimistic concurrency done without full-blob compare?
  **A:** Monotonic `version` column; CAS on `version`. _Rationale:_ O(1), removes
  blob transfer, decouples from JSON canonicalization. _Rejected:_ content-hash of
  the row (works but costs a hash per write and still couples to serialization);
  DB-level `SELECT FOR UPDATE` (heavier, worse under the multi-replica topology).
- **Q:** Does delta handoff risk an incoming agent missing context that predates
  `since`?
  **A:** No — a delta handoff carries the prior `HandoffId`; the receiver can walk
  the `since` chain to reconstruct full state, but pulls each ref's bytes at most
  once (content-addressed). A `--full` handoff is always available as the safe
  default when no prior handoff is trusted. _Rejected:_ always-full handoffs
  (correct but Θ(N²) tokens); deltas with no back-pointer (loses recoverability).
- **Q:** Should `grill` be a new typed entity or reuse `memory kind=grill`?
  **A:** Start as typed `grill.*` events over memory-backed challenge/response
  records; promote to a first-class entity only if the challenge/response shape
  diverges from memory. _Rationale:_ simplicity + reversibility; ship the protocol
  before the schema hardens. _Rejected:_ new entity up front (premature; memory
  already carries `key`/`summary`/`content`/`labels`).
- **Q:** Does semantic recall break determinism / vendor-neutrality?
  **A:** It is opt-in and negotiated (`supports_semantic_recall`); the default
  recall path stays exact and adapter-portable. _Rationale:_ determinism is a
  protocol invariant; relevance retrieval is an optimization, not a guarantee.
  _Rejected:_ semantic-by-default (nondeterministic coordination), external vector
  DB (second dependency).
- **Q:** Blobs are immutable — how is storage reclaimed?
  **A:** `refcount` on `blobs`, decremented when a referencing record is deleted or
  superseded; swept at `refcount=0` in the existing retention job. _Rationale:_
  reuses the [[ADR-0008]] sweeper; no new daemon. _Rejected:_ mark-and-sweep GC
  over all references (O(N) scan, needless at this scale).
- **Q (escalated, defaulted):** What embedding provider backs semantic recall?
  **A:** None mandated by the protocol. The host exposes an embedding seam; the
  reference host ships a local/offline default and treats the provider as
  configuration. Flag: `ACP_EMBEDDING_PROVIDER`. Surfaced for product confirmation;
  chosen conservatively to avoid a hard external dependency.

## Validation

Direction + design only; no code in this slice. Evidence: the 2026-07-05
architecture map of `src/infrastructure/storage/{storage,postgres-store,sqlite-store,in-memory-store}.ts`,
`src/domain/{work-units,artifacts,memory,checkpoints}/*-service.ts`,
`src/app/server/resume-routes.ts`, `src/protocol/schema/{memory,checkpoint,artifact,resume}.schema.ts`,
and confirmation via `grep` that no hashing/summarization/compression/lazy-loading
exists in `src/` today. Each subsequent slice validates with the adapter
conformance suite + dogfood harnesses (`scripts/acp-*-dogfood-*.mjs`).

## Referenced by

[[ADR-0001-architecture-foundation]] · [[ADR-0008-deployment-storage-topology]] ·
[[Storage]] · [[Memory]] · [[Checkpoint]] · [[Artifact]] · [[Event]] ·
[[decisions/_MOC]]
