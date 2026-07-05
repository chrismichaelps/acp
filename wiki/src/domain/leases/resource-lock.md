---
type: module
path: '@root/src/domain/leases/resource-lock.ts'
fidelity: Active
domain: '[[Lease]]'
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
depth_score: 0.68
depth_status: MEDIUM
tags: [module, medium]
aliases: [lease-resource-lock, resource-lock]
---

# Lease Resource Lock

## Purpose

Hold the small durable row protocol that lets [[lease-service]] elect exactly one
active owner for a resource across replicated hosts. The module does not decide
whether a [[Lease]] should be granted; it supplies the storage collection name,
the deterministic resource key, the encoded lock shape, and the guarded removal
logic used by the service.

## Interface

```typescript
export const resourceCollection = 'lease_resource'

export interface ResourceLock {
  readonly lease_id: LeaseId
  readonly holder: WorkerId
  readonly expires_at: Timestamp
}

export const makeResourceLock: (lease: Lease) => ResourceLock
export const resourceKey: (
  workspaceId: WorkspaceId,
  resource: Resource,
) => string
export const readResourceLock: (
  storage: StorageApi,
  workspaceId: WorkspaceId,
  resource: Resource,
) => Effect<Option<ResourceLock>, StorageError>
export const removeResourceLock: (
  storage: StorageApi,
  lease: Lease,
) => Effect<void, StorageError>
```

### Linkage

- **Requires:** [[storage]], [[lease.schema]], [[common]]
- **Consumed by:** [[lease-service]]

## Algorithm

`resourceKey` encodes `workspace_id`, `resource.kind`, and `resource.uri` with
`encodeURIComponent` and joins the parts with `|`, producing a stable key that is
safe for Postgres text columns and SQLite keys. `makeResourceLock` projects only
the data needed to arbitrate a grant: lease id, holder, and expiry. `readResourceLock`
loads the row from [[Storage]] and accepts it only when all required fields have
string values, returning `Option.none` for absent or malformed rows rather than
leaking unchecked JSON into [[lease-service]]. `removeResourceLock` reads the
current row and deletes it only when its `lease_id` still matches the terminating
lease, so a late release or expiry cannot remove a newer holder's row.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT use NUL or binary separators in the resource key; Postgres rejects
  those values in text.
- ❌ Do NOT remove a resource row without checking the current `lease_id`.
- ❌ Do NOT encode lease state into the lock row; the row is only the active
  resource ownership pointer.
- ❌ Do NOT decide grant/deny outcomes here; that remains [[lease-service]]
  behavior.

## Depth

MEDIUM (0.68). The helper hides a narrow but important persistence convention:
resource key normalization, lock row shape, unchecked storage decoding, and
compare-before-remove safety. It stays below [[lease-service]] because domain
semantics, events, TTL policy, and conflict errors belong to the service.

## Referenced by

[[leases/_MOC]] · [[lease-service]] · [[src/_MOC]]
