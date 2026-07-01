/** @Acp.Domain.Leases.Service — Lease lifecycle + conflict guard */
import { Chunk, Context, Duration, Effect, Layer, Option, Schema } from 'effect'
import { AppConfigTag } from '../../config/app-config.js'
import { EventStore } from '../events/index.js'
import { Storage } from '../../infrastructure/storage/index.js'
import {
  InvalidStateTransitionError,
  LeaseConflictError,
  NotFoundError,
  StorageError,
} from '../../protocol/errors/protocol-error.js'
import { Event, Lease, Timestamp } from '../../protocol/schema/index.js'
import type {
  EventType,
  LeaseId,
  LeaseState,
  RequestLeasePayload,
  Resource,
  WorkerId,
  WorkspaceId,
} from '../../protocol/schema/index.js'

export interface RequestLeaseInput {
  readonly id: LeaseId
  readonly payload: RequestLeasePayload
  readonly now: Timestamp
}

export type LeaseServiceError =
  | LeaseConflictError
  | NotFoundError
  | InvalidStateTransitionError
  | StorageError

export interface LeaseServiceApi {
  readonly request: (
    input: RequestLeaseInput,
  ) => Effect.Effect<Lease, LeaseConflictError | StorageError>
  readonly get: (
    leaseId: LeaseId,
  ) => Effect.Effect<Option.Option<Lease>, StorageError>
  readonly list: (
    workspaceId: WorkspaceId,
  ) => Effect.Effect<readonly Lease[], StorageError>
  readonly renew: (
    leaseId: LeaseId,
    actor: WorkerId,
    now: Timestamp,
    ttlSeconds: Option.Option<number>,
  ) => Effect.Effect<Lease, LeaseServiceError>
  readonly release: (
    leaseId: LeaseId,
    actor: WorkerId,
    now: Timestamp,
  ) => Effect.Effect<
    Lease,
    NotFoundError | InvalidStateTransitionError | StorageError
  >
  readonly revoke: (
    leaseId: LeaseId,
    actor: WorkerId,
    now: Timestamp,
  ) => Effect.Effect<
    Lease,
    NotFoundError | InvalidStateTransitionError | StorageError
  >
  readonly expireDue: (
    workspaceId: WorkspaceId,
    actor: WorkerId,
    now: Timestamp,
  ) => Effect.Effect<readonly Lease[], StorageError>
  readonly expireAllDue: (
    actor: WorkerId,
    now: Timestamp,
  ) => Effect.Effect<readonly Lease[], StorageError>
}

export class LeaseService extends Context.Tag('LeaseService')<
  LeaseService,
  LeaseServiceApi
>() {}

const collection = 'lease'

const decodeStoredLease = (value: unknown) =>
  Schema.decodeUnknown(Lease)(value).pipe(
    Effect.mapError(
      (error) =>
        new StorageError({
          op: 'decode_lease',
          cause: String(error),
        }),
    ),
  )

const sameResource = (left: Resource, right: Resource) =>
  left.kind === right.kind && left.uri === right.uri

const isActiveAt = (lease: Lease, now: Timestamp) =>
  lease.state === 'active' && Date.parse(lease.expires_at) > Date.parse(now)

const expiresAt = (now: Timestamp, ttlMillis: number) =>
  Schema.decodeUnknown(Timestamp)(
    new Date(Date.parse(now) + ttlMillis).toISOString(),
  ).pipe(
    Effect.mapError(
      (error) =>
        new StorageError({
          op: 'decode_lease_expiry',
          cause: String(error),
        }),
    ),
  )

const make = Effect.gen(function* () {
  const storage = yield* Storage
  const events = yield* EventStore
  const config = yield* AppConfigTag

  const encodeLease = (lease: Lease) =>
    Schema.encode(Lease)(lease).pipe(
      Effect.mapError(
        (error) =>
          new StorageError({
            op: 'encode_lease',
            cause: String(error),
          }),
      ),
    )

  const save = (lease: Lease) =>
    Effect.flatMap(encodeLease(lease), (encoded) =>
      storage.put(collection, lease.id, encoded),
    )

  const appendDecodedEvent = (raw: {
    readonly id: string
    readonly type: EventType
    readonly workspace_id: string
    readonly work_id: string | null
    readonly actor: string
    readonly timestamp: string
    readonly data: Record<string, unknown>
  }) =>
    Effect.flatMap(
      Schema.decodeUnknown(Event)({ ...raw, seq: 0 }).pipe(
        Effect.mapError(
          (error) =>
            new StorageError({
              op: 'decode_lease_event',
              cause: String(error),
            }),
        ),
      ),
      (event) =>
        events.append({
          id: event.id,
          type: event.type,
          workspace_id: event.workspace_id,
          work_id: event.work_id,
          actor: event.actor,
          timestamp: event.timestamp,
          data: event.data,
        }),
    )

  const appendLeaseEvent = (
    lease: Lease,
    actor: WorkerId,
    timestamp: Timestamp,
    type: EventType,
  ) =>
    appendDecodedEvent({
      id: `event_${lease.id}_${type}_${timestamp}`,
      type,
      workspace_id: lease.workspace_id,
      work_id: Option.getOrNull(lease.work_id),
      actor,
      timestamp,
      data: {
        lease_id: lease.id,
        state: lease.state,
        resource_kind: lease.resource.kind,
        resource_uri: lease.resource.uri,
      },
    })

  const appendRequestPhaseEvent = (
    input: RequestLeaseInput,
    type: EventType,
    holder: WorkerId,
  ) =>
    appendDecodedEvent({
      id: `event_${input.id}_${type}_${input.now}`,
      type,
      workspace_id: input.payload.workspace_id,
      work_id: Option.getOrNull(input.payload.work_id),
      actor: input.payload.holder,
      timestamp: input.now,
      data: {
        lease_id: input.id,
        holder,
        resource_kind: input.payload.resource.kind,
        resource_uri: input.payload.resource.uri,
      },
    })

  const ttlMillis = (ttlSeconds: Option.Option<number>) =>
    Option.getOrElse(
      Option.map(ttlSeconds, (seconds) => seconds * 1000),
      () => Duration.toMillis(config.defaultLeaseTtl),
    )

  const get: LeaseServiceApi['get'] = (leaseId) =>
    Effect.flatMap(storage.get(collection, leaseId), (stored) =>
      Option.match(stored, {
        onNone: () => Effect.succeed(Option.none<Lease>()),
        onSome: (value) => Effect.map(decodeStoredLease(value), Option.some),
      }),
    )

  const all = () =>
    Effect.flatMap(storage.list(collection), (stored) =>
      Effect.forEach(Chunk.toReadonlyArray(stored), decodeStoredLease),
    )

  const list: LeaseServiceApi['list'] = (workspaceId) =>
    Effect.map(all(), (leases) =>
      leases.filter((lease) => lease.workspace_id === workspaceId),
    )

  const requireLease = (leaseId: LeaseId) =>
    Effect.flatMap(get(leaseId), (lease) =>
      Option.match(lease, {
        onNone: () =>
          Effect.fail(new NotFoundError({ entity: 'lease', id: leaseId })),
        onSome: Effect.succeed,
      }),
    )

  const findActiveConflict = (
    workspaceId: WorkspaceId,
    holder: WorkerId,
    resource: Resource,
    now: Timestamp,
  ) =>
    Effect.map(list(workspaceId), (leases) =>
      leases.find(
        (lease) =>
          isActiveAt(lease, now) &&
          sameResource(lease.resource, resource) &&
          lease.holder !== holder,
      ),
    )

  const transition = (
    lease: Lease,
    to: LeaseState,
    actor: WorkerId,
    now: Timestamp,
    type: EventType,
  ) =>
    Effect.gen(function* () {
      if (lease.state !== 'active') {
        return yield* Effect.fail(
          new InvalidStateTransitionError({ from: lease.state, to }),
        )
      }

      const next: Lease = { ...lease, state: to }
      yield* save(next)
      yield* appendLeaseEvent(next, actor, now, type)
      return next
    })

  const request: LeaseServiceApi['request'] = (input) =>
    Effect.gen(function* () {
      const conflict = yield* findActiveConflict(
        input.payload.workspace_id,
        input.payload.holder,
        input.payload.resource,
        input.now,
      )

      if (conflict !== undefined) {
        yield* appendRequestPhaseEvent(
          input,
          'lease.requested',
          input.payload.holder,
        )
        yield* appendRequestPhaseEvent(input, 'lease.denied', conflict.holder)
        return yield* Effect.fail(
          new LeaseConflictError({
            resourceUri: input.payload.resource.uri,
            holderWorkerId: conflict.holder,
          }),
        )
      }

      const lease: Lease = {
        id: input.id,
        workspace_id: input.payload.workspace_id,
        work_id: input.payload.work_id,
        holder: input.payload.holder,
        resource: input.payload.resource,
        expires_at: yield* expiresAt(
          input.now,
          ttlMillis(input.payload.ttl_seconds),
        ),
        state: 'active',
      }

      yield* save(lease)
      yield* appendRequestPhaseEvent(
        input,
        'lease.requested',
        input.payload.holder,
      )
      yield* appendLeaseEvent(
        lease,
        input.payload.holder,
        input.now,
        'lease.granted',
      )
      return lease
    })

  const renew: LeaseServiceApi['renew'] = (leaseId, actor, now, ttlSeconds) =>
    Effect.flatMap(requireLease(leaseId), (lease) =>
      Effect.gen(function* () {
        if (!isActiveAt(lease, now)) {
          return yield* Effect.fail(
            new InvalidStateTransitionError({
              from: lease.state,
              to: 'active',
            }),
          )
        }

        const next: Lease = {
          ...lease,
          expires_at: yield* expiresAt(now, ttlMillis(ttlSeconds)),
        }
        yield* save(next)
        yield* appendLeaseEvent(next, actor, now, 'lease.renewed')
        return next
      }),
    )

  const release: LeaseServiceApi['release'] = (leaseId, actor, now) =>
    Effect.flatMap(requireLease(leaseId), (lease) =>
      transition(lease, 'released', actor, now, 'lease.released'),
    )

  const revoke: LeaseServiceApi['revoke'] = (leaseId, actor, now) =>
    Effect.flatMap(requireLease(leaseId), (lease) =>
      transition(lease, 'revoked', actor, now, 'lease.revoked'),
    )

  const expireEach = (
    leases: readonly Lease[],
    actor: WorkerId,
    now: Timestamp,
  ) =>
    Effect.forEach(
      leases.filter(
        (lease) =>
          lease.state === 'active' &&
          Date.parse(lease.expires_at) <= Date.parse(now),
      ),
      (lease) =>
        Effect.gen(function* () {
          const next: Lease = { ...lease, state: 'expired' }
          yield* save(next)
          yield* appendLeaseEvent(next, actor, now, 'lease.expired')
          return next
        }),
    )

  const expireDue: LeaseServiceApi['expireDue'] = (workspaceId, actor, now) =>
    Effect.flatMap(list(workspaceId), (leases) =>
      expireEach(leases, actor, now),
    )

  const expireAllDue: LeaseServiceApi['expireAllDue'] = (actor, now) =>
    Effect.flatMap(all(), (leases) => expireEach(leases, actor, now))

  return {
    request,
    get,
    list,
    renew,
    release,
    revoke,
    expireDue,
    expireAllDue,
  } satisfies LeaseServiceApi
})

export const LeaseServiceLive: Layer.Layer<
  LeaseService,
  never,
  Storage | EventStore | AppConfigTag
> = Layer.effect(LeaseService, make)
