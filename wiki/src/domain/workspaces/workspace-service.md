---
type: module
path: '@root/src/domain/workspaces/workspace-service.ts'
fidelity: Active
domain: '[[Workspace]]'
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
depth_score: 0.7
depth_status: DEEP
tags: [module, deep]
aliases: [workspace-service, WorkspaceService]
---

# Workspace Service

## Purpose

Own the [[Workspace]] registry for v0.1: create a workspace, read a stored
workspace, list all workspaces, update active workspace metadata, and archive a
workspace. Persists through [[Storage]] (schema-encode on write, schema-decode on
read) and emits the matching `workspace.*` [[Event]] through [[EventStore]] — a
[[Workspace]] _is_ the per-workspace event scope, so its events append to its own
log.

## Interface

### Signatures

```typescript
export interface WorkspaceServiceApi {
  readonly create: (
    workspace: Workspace,
    actor: WorkerId,
    now: Timestamp,
  ) => Effect<Workspace, StorageError>
  readonly get: (id: WorkspaceId) => Effect<Option<Workspace>, StorageError>
  readonly list: () => Effect<readonly Workspace[], StorageError>
  readonly update: (
    workspace: Workspace,
    actor: WorkerId,
    now: Timestamp,
  ) => Effect<
    Workspace,
    NotFoundError | InvalidStateTransitionError | StorageError
  >
  readonly archive: (
    id: WorkspaceId,
    actor: WorkerId,
    now: Timestamp,
  ) => Effect<
    Workspace,
    NotFoundError | InvalidStateTransitionError | StorageError
  >
}

export class WorkspaceService extends Context.Tag('WorkspaceService')<
  WorkspaceService,
  WorkspaceServiceApi
>() {}
export const WorkspaceServiceLive: Layer.Layer<
  WorkspaceService,
  never,
  Storage | EventStore
>
```

### Governance

- The caller supplies the full `Workspace` value (id, kind, uri); this service does
  not mint identifiers (consistent with [[work-unit-service]] and [[worker-service]]
  — no ID/clock seams yet).
- `update` targets an **existing active** workspace (`NotFoundError` otherwise) and
  replaces its mutable fields; `create` is the only path that introduces a new id.
- `archive` is a one-way lifecycle transition from `active` to `archived` and emits
  `workspace.archived` after persistence.
- Records are schema-encoded before storage and schema-decoded after reads so
  `Option` fields never leak as raw JSON inside the service.
- Each mutation emits its `workspace.*` event **after** the state is persisted.

### Linkage

- **Requires:** [[storage]], [[event-store]], [[workspace.schema]], [[common]],
  [[protocol-error]]
- **Consumed by:** [[workspace-routes]] (`GET`/`POST`/`PATCH /v1/workspaces`) and
  future CLI workspace commands.

## Algorithm

1. `create` encodes the `Workspace` through [[workspace.schema]], `put`s it into the
   `workspace` collection, emits `workspace.created`, and returns the workspace.
2. `get` loads the record; `Option.none` for absence, otherwise decodes.
3. `list` reads the whole `workspace` collection and decodes every record into a
   plain `readonly Workspace[]` (the JSON edge — arrays are allowed here).
4. `update` loads the workspace (or fails `NotFoundError`), rejects archived
   workspaces with `InvalidStateTransitionError`, saves the replacement as
   `active`, emits `workspace.updated`, and returns it.
5. `archive` loads the workspace, rejects an already archived workspace with
   `InvalidStateTransitionError`, saves the record with `state: archived`, emits
   `workspace.archived`, and returns it.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT mutate a workspace record outside this service.
- ❌ Do NOT write raw undecoded objects into the `workspace` collection.
- ❌ Do NOT emit an event before its state change is persisted.
- ❌ Do NOT generate `WorkspaceId`s here; the caller supplies the identity.
- ❌ Do NOT physically remove an archived workspace; archive must preserve replay.

## Depth

DEEP (0.70). The service hides storage collection naming, schema encode/decode
drift protection, missing-workspace handling, and per-workspace event emission
behind five methods. Deleting it would scatter encode/decode plumbing and event
ordering across every transport caller.

## Grill Log

- **Q:** Should workspace mutations emit [[Event]]s, given the [[Worker]] slice
  deferred presence events?
  **A:** Yes — emit `workspace.created`/`workspace.updated`. _Rationale:_ the [[Event]]
  log is keyed by `workspace_id`, and a [[Workspace]] _is_ that scope, so its events
  append to its own log with no synthetic entity (unlike a host-scoped [[Worker]]).
  This matches the [[work-unit-service]] emit-after-persist pattern. _Rejected:_ a
  silent registry (loses the audit trail the protocol's event-sourced model depends
  on, spec §4.6).
- **Q:** Spec §11 lists `workspace.archived`. What persisted representation should
  back it?
  **A:** Add a small [[common|WorkspaceState]] lifecycle with `active` and `archived`.
  _Rationale:_ archive is neither deletion nor metadata replacement; a state field
  preserves workspace history and lets replay show why no further mutations should
  occur. _Rejected:_ physical `storage.remove` (breaks replay); ad-hoc metadata flag
  (untyped and invisible to clients); soft-delete timestamp (more policy than v0.1
  needs).
- **Q:** Is `update` a full replacement or a field patch?
  **A:** Full replacement keyed by id. _Rationale:_ the caller decodes a complete
  `Workspace` at the transport edge; a replacement is the simplest, most reversible
  contract and avoids a partial-update merge schema this early. _Rejected:_ a
  `WorkspacePatch` schema (premature for EXPLORING maturity; add when partial PATCH
  semantics are actually needed).
- **Q:** Should archived workspaces be hidden from `list`?
  **A:** No — list returns all workspace records with their lifecycle state. _Rationale:_
  archival is audit state, not disappearance; clients can filter. _Rejected:_ hiding
  archives by default (surprising for recovery and replay).

## Variants

Rejected: folding workspace lifecycle into a state machine like [[work-unit-service]].
A Workspace has no ordered lifecycle in v0.1 (no states beyond existence), so a
registry-with-events is the honest shape.

## Referenced by

[[workspace-service-index]] · [[Workspace]] · [[src/_MOC]]
