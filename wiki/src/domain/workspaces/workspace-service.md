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
workspace, list all workspaces, and update a workspace's mutable fields. Persists
through [[Storage]] (schema-encode on write, schema-decode on read) and emits the
matching `workspace.*` [[Event]] through [[EventStore]] — a [[Workspace]] _is_ the
per-workspace event scope, so its events append to its own log.

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
  ) => Effect<Workspace, NotFoundError | StorageError>
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
- `update` targets an **existing** workspace (`NotFoundError` otherwise) and replaces
  its mutable fields; `create` is the only path that introduces a new id.
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
4. `update` loads the workspace (or fails `NotFoundError`), saves the replacement,
   emits `workspace.updated`, and returns it.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT mutate a workspace record outside this service.
- ❌ Do NOT write raw undecoded objects into the `workspace` collection.
- ❌ Do NOT emit an event before its state change is persisted.
- ❌ Do NOT generate `WorkspaceId`s here; the caller supplies the identity.

## Depth

DEEP (0.70). The service hides storage collection naming, schema encode/decode
drift protection, missing-workspace handling, and per-workspace event emission
behind four methods. Deleting it would scatter encode/decode plumbing and event
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
- **Q:** Spec §11 lists `workspace.archived`. Should `archive` ship in this slice?
  **A:** No — deferred. _Rationale:_ the [[Workspace]] schema (spec §10.2) carries no
  lifecycle/`archived` field, so archival has no persisted representation. Modeling it
  requires either a schema change (add `state`) or a soft-delete convention — a
  design decision worth its own slice rather than inventing a field the spec does not
  define. _Rejected:_ (a) `storage.remove` on archive (orphans the workspace's event
  log and breaks replay); (b) adding an ad-hoc `archived` boolean not in the wire
  schema (silent schema drift).
- **Q:** Is `update` a full replacement or a field patch?
  **A:** Full replacement keyed by id. _Rationale:_ the caller decodes a complete
  `Workspace` at the transport edge; a replacement is the simplest, most reversible
  contract and avoids a partial-update merge schema this early. _Rejected:_ a
  `WorkspacePatch` schema (premature for EXPLORING maturity; add when partial PATCH
  semantics are actually needed).

## Variants

Rejected: folding workspace lifecycle into a state machine like [[work-unit-service]].
A Workspace has no ordered lifecycle in v0.1 (no states beyond existence), so a
registry-with-events is the honest shape.

## Referenced by

[[workspace-service-index]] · [[Workspace]] · [[src/_MOC]]
