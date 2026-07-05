/** @Acp.Domain.Leases.ResourceLock — durable resource ownership rows */
import { Effect, Option } from 'effect'
import type { StorageApi } from '../../infrastructure/storage/index.js'
import type {
  Lease,
  LeaseId,
  Resource,
  Timestamp,
  WorkerId,
  WorkspaceId,
} from '../../protocol/schema/index.js'

export const resourceCollection = 'lease_resource'

export interface ResourceLock {
  readonly lease_id: LeaseId
  readonly holder: WorkerId
  readonly expires_at: Timestamp
}

export const makeResourceLock = (lease: Lease): ResourceLock => ({
  lease_id: lease.id,
  holder: lease.holder,
  expires_at: lease.expires_at,
})

export const resourceKey = (workspaceId: WorkspaceId, resource: Resource) =>
  [
    encodeURIComponent(workspaceId),
    encodeURIComponent(resource.kind),
    encodeURIComponent(resource.uri),
  ].join('|')

export const readResourceLock = (
  storage: StorageApi,
  workspaceId: WorkspaceId,
  resource: Resource,
) =>
  Effect.map(
    storage.get(resourceCollection, resourceKey(workspaceId, resource)),
    (stored) =>
      Option.flatMap(stored, (value) => {
        if (
          typeof value === 'object' &&
          value !== null &&
          'lease_id' in value &&
          'holder' in value &&
          'expires_at' in value &&
          typeof value.lease_id === 'string' &&
          typeof value.holder === 'string' &&
          typeof value.expires_at === 'string'
        ) {
          return Option.some(value as unknown as ResourceLock)
        }
        return Option.none<ResourceLock>()
      }),
  )

export const removeResourceLock = (storage: StorageApi, lease: Lease) =>
  Effect.flatMap(
    readResourceLock(storage, lease.workspace_id, lease.resource),
    (lock) =>
      Option.match(lock, {
        onNone: () => Effect.void,
        onSome: (found) =>
          found.lease_id === lease.id
            ? storage.remove(
                resourceCollection,
                resourceKey(lease.workspace_id, lease.resource),
              )
            : Effect.void,
      }),
  )
