/** @Acp.Domain.Leases.Service.Test — Lease lifecycle + conflict guard */
import { describe, expect, it } from 'vitest'
import { Chunk, Duration, Effect, Layer, Option, Schema } from 'effect'
import { AppConfigTag } from '../../config/app-config.js'
import { EventStore, EventStoreLive } from '../events/index.js'
import { InMemoryStorageLive } from '../../infrastructure/storage/index.js'
import type { LeaseConflictError } from '../../protocol/errors/protocol-error.js'
import {
  LeaseId,
  RequestLeasePayload,
  Timestamp,
  WorkerId,
  WorkspaceId,
} from '../../protocol/schema/index.js'
import { LeaseService, LeaseServiceLive } from './index.js'
import type { Event } from '../../protocol/schema/index.js'

const TestConfigLive = Layer.succeed(AppConfigTag, {
  port: 4317,
  logLevel: 'info' as const,
  defaultLeaseTtl: Duration.minutes(15),
  eventRetentionDays: 30,
  maxArtifactSizeBytes: 16 * 1024 * 1024,
  sseHeartbeat: Duration.seconds(15),
})

const StorageAndEventsLive = Layer.provideMerge(
  EventStoreLive,
  InMemoryStorageLive,
)
const LeaseDependenciesLive = Layer.provideMerge(
  StorageAndEventsLive,
  TestConfigLive,
)
const TestLive = Layer.provideMerge(LeaseServiceLive, LeaseDependenciesLive)

const runSync = <A, E>(
  program: Effect.Effect<A, E, LeaseService | EventStore>,
): A => Effect.runSync(Effect.provide(program, TestLive))

const workspaceId = Schema.decodeUnknownSync(WorkspaceId)('workspace_lease')
const leaseId = Schema.decodeUnknownSync(LeaseId)('lease_file_auth')
const otherLeaseId = Schema.decodeUnknownSync(LeaseId)('lease_file_other')
const workerId = Schema.decodeUnknownSync(WorkerId)('agent_codex')
const otherWorkerId = Schema.decodeUnknownSync(WorkerId)('agent_claude')
const now = Schema.decodeUnknownSync(Timestamp)('2026-06-26T03:00:00.000Z')
const oneMinuteLater = Schema.decodeUnknownSync(Timestamp)(
  '2026-06-26T03:01:00.000Z',
)
const thirtySecondsLater = Schema.decodeUnknownSync(Timestamp)(
  '2026-06-26T03:00:30.000Z',
)
const afterExpiry = Schema.decodeUnknownSync(Timestamp)(
  '2026-06-26T03:20:00.000Z',
)

const requestPayload = Schema.decodeUnknownSync(RequestLeasePayload)({
  workspace_id: workspaceId,
  work_id: 'work_lease',
  holder: workerId,
  resource: { kind: 'file', uri: 'file://src/auth/callback.ts' },
  ttl_seconds: 60,
})

const requestInput = (id = leaseId, payload = requestPayload) => ({
  id,
  payload,
  now,
})

describe('LeaseService', () => {
  it('grants a lease, persists it, and emits lease.granted', () => {
    const result = runSync(
      Effect.gen(function* () {
        const leases = yield* LeaseService
        const events = yield* EventStore
        const granted = yield* leases.request(requestInput())
        const stored = yield* leases.get(leaseId)
        const log = yield* events.readAfter(workspaceId, 0)
        return { granted, stored, log }
      }),
    )

    expect(result.granted.state).toBe('active')
    expect(result.granted.expires_at).toBe('2026-06-26T03:01:00.000Z')
    expect(Option.getOrNull(result.stored)).toEqual(result.granted)
    expect(
      Chunk.toReadonlyArray(result.log).map((event: Event) => event.type),
    ).toEqual(['lease.granted'])
  })

  it('uses configured default TTL when the request omits ttl_seconds', () => {
    const lease = runSync(
      Effect.gen(function* () {
        const leases = yield* LeaseService
        return yield* leases.request(
          requestInput(
            otherLeaseId,
            Schema.decodeUnknownSync(RequestLeasePayload)({
              workspace_id: workspaceId,
              holder: workerId,
              resource: { kind: 'branch', uri: 'git://branch/main' },
            }),
          ),
        )
      }),
    )

    expect(lease.expires_at).toBe('2026-06-26T03:15:00.000Z')
  })

  it('rejects a conflicting active lease held by another worker', () => {
    const error = runSync(
      Effect.either(
        Effect.gen(function* () {
          const leases = yield* LeaseService
          yield* leases.request(requestInput())
          return yield* leases.request(
            requestInput(
              otherLeaseId,
              Schema.decodeUnknownSync(RequestLeasePayload)({
                workspace_id: workspaceId,
                holder: otherWorkerId,
                resource: requestPayload.resource,
                ttl_seconds: 60,
              }),
            ),
          )
        }),
      ),
    )

    expect(error._tag).toBe('Left')
    if (error._tag === 'Left') {
      expect(error.left._tag).toBe('LeaseConflictError')
      expect((error.left as LeaseConflictError).holderWorkerId).toBe(workerId)
    }
  })

  it('renews an active lease and emits lease.renewed', () => {
    const result = runSync(
      Effect.gen(function* () {
        const leases = yield* LeaseService
        const events = yield* EventStore
        yield* leases.request(requestInput())
        const renewed = yield* leases.renew(
          leaseId,
          workerId,
          thirtySecondsLater,
          Option.some(120),
        )
        const log = yield* events.readAfter(workspaceId, 0)
        return { renewed, log }
      }),
    )

    expect(result.renewed.expires_at).toBe('2026-06-26T03:02:30.000Z')
    expect(
      Chunk.toReadonlyArray(result.log).map((event: Event) => event.type),
    ).toEqual(['lease.granted', 'lease.renewed'])
  })

  it('releases and revokes active leases', () => {
    const states = runSync(
      Effect.gen(function* () {
        const leases = yield* LeaseService
        yield* leases.request(requestInput())
        yield* leases.request(
          requestInput(
            otherLeaseId,
            Schema.decodeUnknownSync(RequestLeasePayload)({
              workspace_id: workspaceId,
              holder: otherWorkerId,
              resource: { kind: 'directory', uri: 'file://src/domain' },
              ttl_seconds: 60,
            }),
          ),
        )
        const released = yield* leases.release(
          leaseId,
          workerId,
          oneMinuteLater,
        )
        const revoked = yield* leases.revoke(
          otherLeaseId,
          workerId,
          oneMinuteLater,
        )
        return [released.state, revoked.state]
      }),
    )

    expect(states).toEqual(['released', 'revoked'])
  })

  it('expires due active leases and leaves future leases alone', () => {
    const result = runSync(
      Effect.gen(function* () {
        const leases = yield* LeaseService
        const events = yield* EventStore
        yield* leases.request(requestInput())
        yield* leases.request(
          requestInput(
            otherLeaseId,
            Schema.decodeUnknownSync(RequestLeasePayload)({
              workspace_id: workspaceId,
              holder: otherWorkerId,
              resource: { kind: 'directory', uri: 'file://src/domain' },
              ttl_seconds: 3600,
            }),
          ),
        )
        const expired = yield* leases.expireDue(
          workspaceId,
          workerId,
          afterExpiry,
        )
        const remaining = yield* leases.list(workspaceId)
        const log = yield* events.readAfter(workspaceId, 0)
        return { expired, remaining, log }
      }),
    )

    expect(result.expired.map((lease) => lease.id)).toEqual([leaseId])
    expect(result.remaining.map((lease) => lease.state).sort()).toEqual([
      'active',
      'expired',
    ])
    expect(
      Chunk.toReadonlyArray(result.log).map((event: Event) => event.type),
    ).toEqual(['lease.granted', 'lease.granted', 'lease.expired'])
  })

  it('fails release with NotFoundError for a missing lease', () => {
    const error = runSync(
      Effect.either(
        Effect.gen(function* () {
          const leases = yield* LeaseService
          return yield* leases.release(
            Schema.decodeUnknownSync(LeaseId)('lease_missing'),
            workerId,
            oneMinuteLater,
          )
        }),
      ),
    )

    expect(error._tag).toBe('Left')
    if (error._tag === 'Left') {
      expect(error.left._tag).toBe('NotFoundError')
    }
  })

  it('rejects renewing an expired lease with InvalidStateTransitionError', () => {
    const error = runSync(
      Effect.either(
        Effect.gen(function* () {
          const leases = yield* LeaseService
          yield* leases.request(requestInput())
          return yield* leases.renew(
            leaseId,
            workerId,
            afterExpiry,
            Option.some(60),
          )
        }),
      ),
    )

    expect(error._tag).toBe('Left')
    if (error._tag === 'Left') {
      expect(error.left._tag).toBe('InvalidStateTransitionError')
    }
  })
})
