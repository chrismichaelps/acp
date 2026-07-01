---
type: module
path: '@root/src/domain/leases/lease-service.ts'
fidelity: Active
domain: '[[Lease]]'
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
depth_score: 0.76
depth_status: DEEP
tags: [module, deep]
aliases: [lease-service, LeaseService]
---

# Lease Service

## Purpose

Own the [[Lease]] lifecycle for v0.1. A lease is a temporary claim over a
resource inside a [[Workspace]], usually for a [[WorkUnit]], and its purpose is to
prevent two [[Worker]]s from editing the same resource at the same time. The
service persists leases through [[Storage]], emits `lease.*` [[Event]] records
through [[EventStore]], and uses [[app-config]] for the default TTL when a request
does not override it.

## Interface

### Signatures

```typescript
export interface RequestLeaseInput {
  readonly id: LeaseId
  readonly payload: RequestLeasePayload
  readonly now: Timestamp
}

export interface LeaseServiceApi {
  readonly request: (
    input: RequestLeaseInput,
  ) => Effect<Lease, LeaseConflictError | StorageError>
  readonly get: (leaseId: LeaseId) => Effect<Option<Lease>, StorageError>
  readonly list: (
    workspaceId: WorkspaceId,
  ) => Effect<readonly Lease[], StorageError>
  readonly renew: (
    leaseId: LeaseId,
    actor: WorkerId,
    now: Timestamp,
    ttlSeconds: Option<number>,
  ) => Effect<Lease, LeaseServiceError>
  readonly release: (
    leaseId: LeaseId,
    actor: WorkerId,
    now: Timestamp,
  ) => Effect<Lease, NotFoundError | InvalidStateTransitionError | StorageError>
  readonly revoke: (
    leaseId: LeaseId,
    actor: WorkerId,
    now: Timestamp,
  ) => Effect<Lease, NotFoundError | InvalidStateTransitionError | StorageError>
  readonly expireDue: (
    workspaceId: WorkspaceId,
    actor: WorkerId,
    now: Timestamp,
  ) => Effect<readonly Lease[], StorageError>
  readonly expireAllDue: (
    actor: WorkerId,
    now: Timestamp,
  ) => Effect<readonly Lease[], StorageError>
}

export class LeaseService extends Context.Tag('LeaseService')<
  LeaseService,
  LeaseServiceApi
>() {}
export const LeaseServiceLive: Layer.Layer<
  LeaseService,
  never,
  Storage | EventStore | AppConfigTag
>
```

### Governance

- The caller supplies `LeaseId` and `Timestamp`, following [[work-unit-service]],
  [[worker-service]], and [[workspace-service]]. No ID or clock seam exists yet.
- `request` computes `expires_at` from `ttl_seconds` when present, otherwise from
  `AppConfig.defaultLeaseTtl`.
- A lease conflicts only with an active, unexpired lease for the same
  `{resource.kind, resource.uri}` in the same [[Workspace]] held by another
  [[Worker]].
- Mutations persist state before emitting the corresponding `lease.*` [[Event]].
- `expireDue` (one workspace) and `expireAllDue` (every workspace, scanning all
  stored leases) lapse due active leases to `expired`, each emitting `lease.expired`;
  the [[sweeper]] calls `expireAllDue` so a lease in an unregistered workspace still
  lapses.

### Linkage

- **Requires:** [[storage]], [[event-store]], [[app-config]], [[lease.schema]],
  [[common]], [[protocol-error]]
- **Consumed by:** [[acp-router]] (`/v1/leases`, spec §12), CLI, dogfood
  runners, and the
  [[sweeper]] (`expireAllDue`).

## Algorithm

1. `request` lists leases for the workspace, searches for an active unexpired
   conflicting resource claim, fails `LeaseConflictError` when another holder owns
   the resource, otherwise saves an `active` lease and emits `lease.granted`.
2. `get` loads one lease by id; absence is `Option.none`.
3. `list` decodes the `lease` collection and filters by `workspace_id`.
4. `renew` requires the lease to still be active and unexpired at `now`, extends
   `expires_at`, saves, and emits `lease.renewed`.
5. `release` and `revoke` require `active`, save the terminal state, and emit
   `lease.released` or `lease.revoked`.
6. `expireDue` scans active leases in a workspace, marks those whose
   `expires_at <= now` as `expired`, and emits `lease.expired`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT call a lease a lock or make it permanent.
- ❌ Do NOT grant a resource claim when another active unexpired lease owns the
  same resource in the same workspace.
- ❌ Do NOT hardcode the default TTL; use [[app-config]].
- ❌ Do NOT emit a lease event before the state write succeeds.
- ❌ Do NOT delete expired/released/revoked leases; the history remains readable.

## Depth

DEEP (0.76). The service hides storage collection naming, schema encode/decode,
TTL calculation, conflict detection, terminal-state transition rules, and event
emission behind one domain surface. Deleting it would scatter lease conflict
logic across transport handlers and make resource coordination fragile.

## Grill Log

- **Q:** Should `request` emit `lease.requested` before attempting the grant?
  **A:** No in this slice. _Rationale:_ current domain services emit the durable
  outcome after state has changed. A future audit layer can record failed attempts
  explicitly when it owns host-scoped event semantics. _Rejected:_ appending
  `lease.requested` before persistence (would introduce side effects for a command
  that may still fail).
- **Q:** Should an expired active lease block a new request before `expireDue`
  runs?
  **A:** No. Conflict checks use `expires_at > now`, so an active-but-past lease is
  no longer an active claim. `expireDue` is the cleanup/audit path, not the source
  of truth for whether the claim is still valid.
- **Q:** Should the service mint IDs or read the current clock?
  **A:** No. _Rationale:_ the existing domain services take caller-supplied IDs and
  timestamps until an ID/Clock seam is introduced. Keeping the convention avoids
  hidden runtime dependencies in domain code.

## Variants

Rejected: modeling lease conflicts inside [[Storage]]. Storage is a persistence
seam, not a protocol domain service; conflict semantics belong with [[Lease]]
because they depend on holder, resource identity, workspace scope, expiry, and
state.

## Referenced by

[[leases/_MOC]] · [[Lease]] · [[src/_MOC]]
