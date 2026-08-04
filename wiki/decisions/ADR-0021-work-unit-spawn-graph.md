---
type: decision
status: PROPOSED
date: 2026-08-04
tags: [adr, proposed, work-units, delegation, lineage, state-machine]
aliases: [ADR-0021, work-unit-spawn-graph]
---

# ADR-0021 — Work Unit Spawn Graph

## Status

PROPOSED.

## Context

A delegating agent decomposes a task and hands the pieces to other agents. ACP
records each piece as a `WorkUnit`, but the units are unrelated rows — nothing
records that work B exists because work A asked for it. Three consequences
follow.

Provenance is lost: reconstructing why a unit exists means reading prose
descriptions. Subtree reasoning is impossible: "what is still outstanding under
this task?" has no answer, so a crashed delegator leaves orphaned children that
nothing detects. Worst, completion is premature: a parent can reach
`needs_review` and `completed` while its subtasks are still `running`. The
delegating agent declares victory and the review gate approves a task whose real
work is unfinished. That last one is a correctness bug the host can prevent
structurally rather than by convention.

This design adapts `codex-rs/agent-graph-store` from
[`openai/codex`](https://github.com/openai/codex), which persists parent/child
spawn topology for agent threads. Codex is an agent runtime and ACP is a
coordination host, so the mechanism transfers but the node type and the
lifecycle semantics do not — see Alternatives.

Four further ideas from the same source (`hooks`, `execpolicy`,
`agent-identity`, `rollout` compaction) are independent sub-projects and are out
of scope here.

## Decision

### Lineage lives on work units, set once at creation

`WorkUnit` gains `parent_id` (optional `WorkId`) and `depth` (int, `0` for
roots). `CreateWorkPayload` gains `parent_id` only — `depth` is host-derived and
a client cannot set it.

`parent_id` is immutable. A parent must already exist to be named, so it always
predates its child and a cycle cannot be represented. There is no
cycle-detection code and no test for one: the shape of the API is the proof.

`depth` is redundant with the parent chain but earns its place twice. It makes
the depth-limit check O(1) at creation (`child.depth = parent.depth + 1`)
instead of an unbounded ancestor walk on the hot path, and it gives
`listDescendants` a deterministic `(depth, id)` ordering without recomputation.
Because `parent_id` never changes, `depth` cannot drift.

`parent_id` joins `INDEXED_FIELDS` in [[index-columns]]; that is the entire
storage change, since the promoted-column mechanism yields indexed `queryBy`
across the in-memory, SQLite, and Postgres adapters with no per-adapter code.
`depth` is not indexed — it is only read from rows already fetched.

### Openness is derived, not stored

Codex attaches an `Open`/`Closed` status to each edge because a thread has no
lifecycle state of its own. ACP work units do, so a stored edge status would be
a second source of truth that can disagree with the first. Openness derives from
the existing transition table:

```ts
const isTerminal = (s: WorkState) => allowedTransitions[s].size === 0
// → rejected, completed, cancelled
```

Deriving from the table rather than hardcoding the three names means a future
`WorkState` cannot silently break the gate.

### Creation invariants

With `parent_id` present: the parent must exist (`NotFoundError`); parent and
child must share a workspace, or a subtree could escape workspace-scoped
queries, the event log, and auth scoping; `depth` must be within
`ACP_MAX_WORK_DEPTH` (`DepthLimitExceededError`); and the parent must be in a
child-accepting state — `open`, `claimed`, `running`, `blocked`, or
`changes_requested`.

### The completion gate

A parent may not enter `needs_review` or `completed` while any direct child is
non-terminal. Failure is `IncompleteChildrenError`, carrying the blocking child
ids capped at ten plus the true total count, mapped to HTTP 409 — a state
conflict, not bad input. Consistent with `InvalidStateTransitionError`, a
blocked transition emits no event, because nothing changed.

Both transitions are gated. Gating only `needs_review` leaves a hole: a child
created while the parent sits in `needs_review` would never be checked, and
`approved → completed` would pass unexamined.

Only **direct** children are checked. A non-terminal grandchild forces its own
parent to stay non-terminal, which blocks the grandparent transitively. Walking
the subtree on every transition would pay an unbounded read to enforce what the
recursion already guarantees.

### Subtree queries

`WorkUnitServiceApi` gains `listChildren(workId)` — one indexed `queryBy` — and
`listDescendants(workId, { maxDepth?, limit? })`, breadth-first with one indexed
query per level, ordered by `(depth, id)`. Both bounds default to the configured
depth cap so an unbounded call cannot become an unbounded read.

Deterministic ordering is a requirement, not a nicety: the dogfood scripts
assert exact output, and callers merge persisted graph state with live state.

### Configuration and events

`AppConfig` gains `maxWorkDepth`, env `ACP_MAX_WORK_DEPTH`, default `10`, with
the matching `.env.example` entry that `pnpm check:env` enforces.

No new `EventType`. `work.created` carries `parent_id` and `depth` in its open
`data` record. `EventType` is a closed literal union, so adding a member is a
protocol change every consumer must handle; adding keys to `data` is not. A
`work.spawned` event would be a second name for one fact.

## Rationale

The completion gate is the reason this ADR exists. Lineage alone is provenance
you still have to act on manually; the gate converts it into an invariant the
host enforces, and it composes with the review gate already in place — a parent
cannot reach review with live children, so a reviewer never evaluates a
half-finished decomposition.

Choosing work units over workers as the node type follows from durability.
Workers are ephemeral: a worker-to-worker edge dies with the process and says
nothing about what work is orphaned. Work units carry the lifecycle state
machine, are what gets reviewed and cancelled, and survive a crashed worker.
Actor attribution is already covered by `created_by` and `assigned_to`.

The depth cap is not optional. Unbounded chains make descendant traversal an
unbounded query, and an agent that recursively delegates is a real failure mode.
The cap turns an accumulating resource leak into a clean, attributable error.

## Consequences

Existing clients and stored rows stay valid: both wire additions are optional or
host-derived, a row without `parent_id` decodes as a root, and a pre-existing row
decodes with `depth = 0`, which is correct because it has no parent. Protocol
stays at v0.1; this is a release-level minor bump via `acp bump`.

The gate is a new way for a previously-succeeding transition to fail. Any agent
that creates child work must now handle 409 on `needs_review` — a deliberate
behavioral change, and the point of the ADR, but it must be documented in
[[agent-integration]] and `ACP-SKILL.md` before release.

The gate reads children and then writes the parent. Those are different rows, so
the parent's version-CAS does not make the pair atomic. The child-accepting-state
invariant closes the interleaving from the other side, so a child is only
admitted while the parent is still gateable. A narrow window remains — a child
admitted after the gate's read but before the parent's write. This is accepted,
not papered over: the parent still cannot reach `completed`, because
`approved → completed` re-runs the gate and catches the straggler, and closing
the window fully would require cross-row transactions the storage port does not
expose and the in-memory adapter could not honor. The residual effect is a
parent briefly in `needs_review` with one live child — visible, recoverable, and
not a lost update.

Both queries must be exposed over REST, native RPC, JSON-RPC, and the CLI, and
`openapi.json` regenerated. SSE is unchanged, since there are no new event types.

## Alternatives

**Worker-to-worker edges**, codex's literal model. Codex has one node type and
so had no choice. Rejected because ACP workers are ephemeral and the edge would
not survive the process whose orphaned work we need to find.

**Mutable parent via upsert**, also codex's model — it needs re-parenting because
threads get re-attached across resumes. Rejected: it requires cycle detection on
every write and makes lineage history mutable, and ACP has no equivalent need.
Adopting orphaned work, if ever demonstrated, is better served by an explicit
audited operation.

**Stored edge status.** Rejected as a second source of truth about a fact
`WorkState` already owns.

**Cascade cancel in this slice.** Rejected for now: cancelling a subtree raises
unsettled questions about atomicity, event volume, and descendants mid-review.
The gate delivers the correctness win alone; cascade is ergonomics and should be
designed against real usage.

**Full-subtree gate checks.** Rejected as an unbounded read enforcing what
direct-child recursion already guarantees.

## Validation

Acceptance requires tests proving: each creation invariant rejects, including
cross-workspace and over-depth parents; every non-terminal child state blocks
both gated transitions and every terminal state permits them; a parent with no
children is unaffected; `isTerminal` is derived from the transition table rather
than a literal list; `parent_id` filtering behaves identically across all three
adapters, extending [[query-conformance.test]]; `listDescendants` ordering is
identical across repeated runs and adapters; and a unit created without
`parent_id` behaves exactly as before, event payloads included.

Plus a dogfood script in which a parent delegates two children, is refused
`needs_review` while they run, and succeeds once both terminate — and the full
typecheck/lint/format/suite gate.

## Grill Log

- **Q:** Why store `depth` when it is derivable from the parent chain? **A:**
  It makes the cap check O(1) instead of an unbounded ancestor walk per create,
  and it cannot drift because `parent_id` is immutable. _Rejected:_ walking the
  chain on every creation.
- **Q:** Why not gate on the full subtree? **A:** A non-terminal grandchild
  already pins its own parent non-terminal, which pins the grandparent. The
  recursion enforces it; the traversal would only pay for it twice. _Rejected:_
  full-subtree traversal per transition.
- **Q:** Why is a residual write race acceptable here? **A:** It cannot produce
  a lost update or a wrongly `completed` parent, because `approved → completed`
  re-runs the gate. Closing it needs cross-row transactions the storage port
  does not expose. _Rejected:_ claiming atomicity the port cannot deliver.
- **Q:** Why no `work.spawned` event? **A:** `EventType` is a closed union, so
  a new member is a breaking protocol change for consumers, and it would carry
  no fact beyond `work.created` with a `parent_id`. _Rejected:_ a dedicated
  lineage event type.

## Referenced by

[[00-INDEX]]
