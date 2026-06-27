/** @Acp.App.Server.Sweeper.Test — one deterministic sweep over a seeded store */
import { describe, expect, it } from 'vitest'
import { Effect, Layer, Option, Schema } from 'effect'
import { LeaseService } from '../../domain/leases/index.js'
import { SessionService } from '../../domain/sessions/index.js'
import {
  LeaseId,
  RequestLeasePayload,
  Session,
  SessionId,
  Timestamp,
} from '../../protocol/schema/index.js'
import { AppLive } from '../index.js'
import { IdClockLive } from './identity.js'
import { sweepOnce } from './sweeper.js'

const Runtime = Layer.mergeAll(AppLive, IdClockLive)

const session = (id: string, createdAt: string) =>
  Schema.decodeUnknownSync(Session)({
    id,
    worker_id: 'agent_claude_code',
    created_at: createdAt,
    permissions: [],
  })

// A lease requested far in the past with a 1s TTL — long expired by `now`.
const stalePayload = Schema.decodeUnknownSync(RequestLeasePayload)({
  workspace_id: 'workspace_1',
  holder: 'agent_claude_code',
  resource: { kind: 'file', uri: 'file://src/auth.ts' },
  ttl_seconds: 1,
})

describe('sweepOnce', () => {
  it('evicts stale sessions and lapses due leases, sparing fresh ones', async () => {
    const program = Effect.gen(function* () {
      const sessions = yield* SessionService
      const leases = yield* LeaseService

      yield* sessions.create(session('session_old', '2000-01-01T00:00:00.000Z'))
      const fresh = session('session_new', new Date().toISOString())
      yield* sessions.create(fresh)

      yield* leases.request({
        id: Schema.decodeUnknownSync(LeaseId)('lease_old'),
        payload: stalePayload,
        now: Schema.decodeUnknownSync(Timestamp)('2000-01-01T00:00:00.000Z'),
      })

      const result = yield* sweepOnce

      return {
        result,
        oldSession: yield* sessions.get(
          Schema.decodeUnknownSync(SessionId)('session_old'),
        ),
        newSession: yield* sessions.get(
          Schema.decodeUnknownSync(SessionId)('session_new'),
        ),
        oldLease: yield* leases.get(
          Schema.decodeUnknownSync(LeaseId)('lease_old'),
        ),
      }
    }).pipe(Effect.provide(Runtime))

    const { result, oldSession, newSession, oldLease } =
      await Effect.runPromise(program)

    expect(result.evictedSessions.map((s) => s.id)).toEqual(['session_old'])
    expect(result.expiredLeases.map((l) => l.id)).toEqual(['lease_old'])

    expect(Option.isNone(oldSession)).toBe(true)
    expect(Option.isSome(newSession)).toBe(true)
    expect(Option.getOrNull(oldLease)?.state).toBe('expired')
  })

  it('is a no-op on an empty store', async () => {
    const result = await Effect.runPromise(
      sweepOnce.pipe(Effect.provide(Runtime)),
    )
    expect(result.evictedSessions).toEqual([])
    expect(result.expiredLeases).toEqual([])
  })
})
