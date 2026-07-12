---
type: module
path: '@root/src/domain/workers/worker-service.ts'
fidelity: Active
domain: '[[Worker]]'
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
depth_score: 0.62
depth_status: MEDIUM
tags: [module, medium]
aliases: [worker-service, WorkerService]
---

# Worker Service

## Purpose

Own the [[Worker]] registry for v0.1: register a worker (the projection of
`POST /v1/session/initialize`), read a stored worker, list all known workers, and
update a worker's [[Worker]] `status`. Persists through [[Storage]] with
schema-encode on write and schema-decode on read so `Option` fields never leak as
raw JSON inside the service.

## Interface

### Signatures

```typescript
export interface WorkerServiceApi {
  readonly register: (worker: Worker) => Effect<Worker, StorageError>
  readonly get: (workerId: WorkerId) => Effect<Option<Worker>, StorageError>
  readonly list: () => Effect<readonly Worker[], StorageError>
  readonly setStatus: (
    workerId: WorkerId,
    status: WorkerStatus,
  ) => Effect<Worker, NotFoundError | StorageError>
}

export class WorkerService extends Context.Tag('WorkerService')<
  WorkerService,
  WorkerServiceApi
>() {}
export const WorkerServiceLive: Layer.Layer<WorkerService, never, Storage>
```

### Governance

- `register` is an idempotent upsert: re-initializing the same `WorkerId`
  overwrites the stored record. The caller owns the `Worker` value (id, kind,
  capabilities); this service does not mint identifiers.
- Worker records are schema-encoded before storage and schema-decoded after reads
  for drift protection.
- `setStatus` on a missing worker fails with `NotFoundError`; storage faults
  collapse to `StorageError`.
- No clock dependency: the [[Worker]] schema carries no timestamps, so `setStatus`
  takes no `now`.

### Linkage

- **Requires:** [[storage]], [[worker.schema]], [[common]], [[protocol-error]]
- **Consumed by:** [[acp-router]] session initialization, [[worker-routes]], and
  CLI/JSON-RPC worker read projections.

## Algorithm

1. `register` encodes the `Worker` through [[worker.schema]] and `put`s it into the
   `worker` collection under `worker.id`, then returns the input worker.
2. `get` loads the record; `Option.none` for absence, otherwise decodes through
   [[worker.schema]].
3. `list` reads the whole `worker` collection and decodes every record into a
   plain `readonly Worker[]` (the JSON edge — arrays are allowed here).
4. `setStatus` loads the worker (or fails `NotFoundError`), rewrites `status`,
   saves, and returns the updated worker.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT mutate a worker record outside this service.
- ❌ Do NOT write raw undecoded objects into the `worker` collection.
- ❌ Do NOT generate `WorkerId`s here; the caller supplies the identity.
- ❌ Do NOT emit per-workspace [[Event]]s for worker presence. Presence is
  host-scoped registry state in v0.1; see [[ADR-0005-worker-presence-scope]].

## Depth

MEDIUM (0.62). The service hides storage collection naming, schema encode/decode
drift protection, upsert-on-register semantics, and missing-worker handling behind
four methods. It is a deep-enough registry but not a state machine; deleting it
would scatter encode/decode plumbing across every transport caller.

## Grill Log

- **Q:** Worker presence events (`worker.online`, `worker.status_changed`) are
  listed in spec §11. Should `register`/`setStatus` emit them through
  [[EventStore]]?
  **A:** No — not in this slice. _Rationale:_ the [[Event]] schema requires a
  `workspace_id` and [[EventStore]] appends to a per-workspace log, but a
  [[Worker]] is host-scoped (registered at `session/initialize`, before any
  workspace context). Emitting would force a synthetic workspace — inventing logic
  the spec does not describe. _Rejected:_ (a) a reserved `__host__` pseudo-workspace
  (leaks a fake entity into the workspace event log); (b) requiring callers to pass
  a `workspace_id` to `setStatus` (couples host-level presence to a workspace the
  worker may not be in yet). [[ADR-0005-worker-presence-scope]] closes this for
  v0.1: status remains registry state. Host-scoped read routes may expose current
  registry state, but live presence events require a separate host-presence stream
  with its own schema and replay policy.
- **Q:** Is `register` create-only or upsert?
  **A:** Upsert. _Rationale:_ `session/initialize` is re-invoked on every reconnect;
  a returning worker must refresh its capabilities/vendor without a separate update
  path. _Rejected:_ failing on duplicate id (forces callers to branch on first-vs-
  subsequent connect — worse UX, leaks connection lifecycle into the registry).
- **Q:** Does `setStatus` validate status transitions (like the WorkUnit state
  machine)?
  **A:** No — any `WorkerStatus` is reachable from any other. _Rationale:_ presence
  is not a lifecycle; a worker may flip `online → offline → busy` in any order and
  the closed `WorkerStatus` vocabulary already constrains the value space.
  _Rejected:_ a presence state machine (over-engineering for a value with no
  invariant ordering).

## Variants

Rejected interface shape: a combined `WorkerService.session(...)` returning a
session id + negotiated host capabilities. Deferred — capability negotiation and
session identity are a transport-edge concern (spec §9), not registry state.

## Referenced by

[[worker-service.test]] · [[worker-service-index]] · [[Worker]] · [[worker-routes]] ·
[[ADR-0005-worker-presence-scope]] · [[src/_MOC]]
