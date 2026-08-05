---
type: decision
status: ACCEPTED
date: 2026-08-04
tags: [adr, accepted, events, storage, metrics, retention]
aliases: [ADR-0025, event-tail-reads]
---

# ADR-0025 — Event Tail Reads and Persistence Metrics

## Status

ACCEPTED — implemented, with one narrowing.

Delivered: `readEventsTail` on the storage port and all three adapters, covered
by the shared conformance suite; `EventStore.readTail`; `GET /v1/events?tail=N`,
rejecting `tail` together with `after_seq`; `acp events list --tail`; and the
`acp_storage_cas_conflicts_total` counter.

Narrowed: per-operation storage count and duration series are **not** shipped.
Instrumenting all fifteen port methods across three adapters would add timing
overhead to every storage call for a signal the RPC and HTTP histograms already
approximate. The CAS counter — which this ADR's own Rationale calls the one with
real diagnostic value — is delivered in full. Per-operation timing can be
revisited if request-level latency ever proves too coarse to localise a problem.

Corrected: this ADR originally said ACP's "version-CAS writes retry under
contention". Only one of the three CAS call sites actually retries
(`session-issuer-live.ts`); work claims and grill answers surface a conflict to
the caller instead. The counter therefore records _lost swaps_ rather than
retries, which is the signal an operator needs in either case, and it is
recorded inside the adapters so a future CAS write cannot forget to report it.

## Context

`codex-rs/rollout` from [`openai/codex`](https://github.com/openai/codex) is the
last of five subsystems evaluated for transfer to ACP. It handles conversation
persistence: a background compression worker, a reverse JSONL scanner, a
queryable session index, and persistence metrics.

Most of it does not transfer, because ACP has already decided these questions
differently and deliberately:

| Codex mechanism            | ACP's existing decision                                                                |
| -------------------------- | -------------------------------------------------------------------------------------- |
| Background log compression | [[ADR-0020-operational-contracts]] — delete-based pruning, explicitly _not_ compaction |
| Session index for lookup   | [[ADR-0010-context-exchange-optimization]] — indexed `queryBy` over promoted columns   |
| Budgeted context reads     | Already shipped — the `WorkResumePacket` budget/elision surface                        |
| JSONL file storage         | Storage port over in-memory / SQLite / Postgres                                        |

Recording that is the point of this ADR: the analysis is otherwise invisible,
and a future reader deserves to know these were considered and why they were not
adopted, rather than rediscovering them.

Two things do transfer.

**Tail reads.** `readEventsAfter(workspaceId, afterSeq, limit)` is ACP's only
cursor into the log, and it walks forward. Answering "the last N events in this
workspace" — the question every dashboard, debugging session, and operator
console asks first — means scanning from `seq = 0`. Codex builds a reverse JSONL
scanner because flat files have no index; ACP stores events in indexed tables
where the same result is one descending query.

**Persistence metrics.** Codex tracks how its persistence layer behaves.
[[ADR-0019-metrics-scrape-endpoint]] exposes RPC, HTTP, and sweeper telemetry,
but the storage layer beneath them is unmeasured — so an operator watching
request latency rise cannot see whether storage caused it.

## Decision

### Add `readEventsTail` to the storage port

```ts
readonly readEventsTail: (
  workspaceId: string,
  limit: number,
) => Effect.Effect<Chunk.Chunk<Event>, StorageError>
```

Returns the `limit` highest-`seq` events for a workspace, **ascending by `seq`**.

Descending internally, ascending on return, deliberately: every existing
consumer of an event `Chunk` — replay, cursor advance, SSE catch-up — assumes
ascending `seq`, and a second ordering convention on the same element type is
how a caller eventually replays history backwards. The descending order is an
implementation detail of the query, not part of the contract.

`limit` is required, not optional. An unbounded tail read is a full-table scan
wearing a convenient name, and making the bound mandatory means the expensive
call cannot be written by accident.

The retention interaction is stated rather than implied: a tail read returns the
newest retained events. Following [[ADR-0020-operational-contracts]], pruning
never resets or reuses `seq`, so a tail read and a cursor read of the same log
agree about ordering and identity.

### Persistence counters on the existing metrics surface

Additive series on `GET /metrics`, following the additive contract
[[ADR-0019-metrics-scrape-endpoint]] already sets: storage operation count and
duration labelled by operation and adapter, plus a counter for CAS swaps lost to contention.

The CAS-retry counter is the one with real diagnostic value. ACP's version-CAS
writes retry under contention, and contention is exactly what a coordination
host experiences when many agents converge on one workspace. Today that pressure
is invisible until it surfaces as latency; counting it makes the cause legible.

Labels are bounded — a fixed operation set and three adapter names — so
cardinality cannot grow with workload.

### Explicitly not adopted

Event compaction, fold-to-summary retention, file-based logs, and a separate
session index are rejected, each because ACP has a working decision in that
space. They are recorded in Alternatives so the evaluation is durable.

## Rationale

This ADR is deliberately small, and its scope is the finding rather than a
consolation prize. Four of the five codex subsystems examined produced
substantial designs; the fifth mostly confirmed that ACP had already made these
calls, which is a useful result and worth recording as one.

Tail reads are worth the port change on their own. The absence forces every
consumer that wants recent history into a full forward scan, and that cost grows
with log size — the classic latent problem that only appears once a deployment
has run long enough to matter.

## Consequences

Three storage adapters gain a method, and the conformance suite gains a case.
The in-memory adapter can satisfy it by slicing; SQLite and Postgres use
`ORDER BY seq DESC LIMIT n` against the existing index, so no new index is
needed.

Exposing tail reads over the transports is a small additive surface —
`GET /workspaces/:id/events?tail=N` alongside the existing cursor parameter,
mirrored on RPC and JSON-RPC — and regenerates `openapi.json`. It is additive
only: the cursor read is unchanged, and `tail` and `after` are mutually
exclusive, since a request that supplied both would have no single sensible
meaning.

New metric series are additive per ADR-0019's contract, so existing scrapes keep
working. Recording durations on the storage path adds per-operation timing
overhead; it is the same instrumentation already applied at the RPC and HTTP
layers, and bounded labels keep scrape size flat.

## Alternatives

**Event compaction / fold-to-summary.** Rejected: ADR-0020 chose delete-based
pruning so that `seq` stays stable and replay stays exact. Compaction would
rewrite history that recovering workers replay against.

**A separate session/thread index.** Rejected: ADR-0010's promoted-column
`queryBy` already provides indexed lookup across all three adapters, and a second
index would be a second thing to keep consistent.

**File-based JSONL event storage.** Rejected: the storage port exists precisely
so deployments choose their backend, and a file log cannot serve the Postgres
topology in ADR-0008.

**Returning tail results in descending order.** Rejected: introduces a second
ordering convention for `Event` chunks, which eventually gets replayed backwards
by a caller that did not read the docs.

**Optional `limit` on tail reads.** Rejected: an unbounded tail is a full scan
with a friendly name.

**Deriving the tail client-side from the existing cursor read.** Rejected: that
is the full forward scan this ADR removes.

## Validation

Acceptance requires tests proving: `readEventsTail` returns the `limit`
highest-`seq` events in ascending `seq` order; it agrees with
`readEventsAfter` about identity and ordering over the overlapping range; it
returns everything, without error, when the log holds fewer than `limit`
events; it is empty for an unknown workspace rather than failing; it never
crosses workspace boundaries; behavior after a prune returns the newest retained
events with no `seq` gaps beyond the pruned range; and all three adapters agree,
extending [[query-conformance.test]].

Plus: `tail` and `after` supplied together is a validation error; the new metric
series appear with bounded labels and the CAS-retry counter increments under
simulated contention; and the full typecheck/lint/format/suite gate.

## Grill Log

- **Q:** Is an ADR worth writing when most of it is "already covered"? **A:**
  Yes. Without it the evaluation is invisible and someone re-proposes compaction
  in a year. Recording a rejection with reasoning is the cheaper half of an ADR's
  value. _Rejected:_ dropping the finding.
- **Q:** Why not return the tail descending, as callers expect for "latest"?
  **A:** A second ordering convention on the same type is a latent replay bug.
  Callers that want newest-first can reverse a bounded chunk. _Rejected:_
  descending results.
- **Q:** Why is `limit` required when `readEventsAfter` makes it optional?
  **A:** An unbounded forward cursor read is a legitimate replay; an unbounded
  tail read is a full scan with no use case. _Rejected:_ symmetry with
  `readEventsAfter`.
- **Q:** Do storage metrics duplicate the RPC and HTTP timings? **A:** No —
  those measure the whole request. Storage timing and the CAS-retry counter are
  what separate "the database is slow" from "agents are contending", which is
  the question a coordination host actually gets asked. _Rejected:_ relying on
  request-level timings.

## Referenced by

[[00-INDEX]]
