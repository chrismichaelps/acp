/** @Acp.App.Server.Sweeper.Test — one deterministic sweep over a seeded store */
import { describe, expect, it } from 'vitest'
import { Chunk, Effect, Layer, Option, Schema } from 'effect'
import { EventStore } from '../../domain/events/index.js'
import { LeaseService } from '../../domain/leases/index.js'
import { SessionService } from '../../domain/sessions/index.js'
import {
  Event,
  LeaseId,
  RequestLeasePayload,
  Session,
  SessionId,
  Timestamp,
} from '../../protocol/schema/index.js'
import { AppLive } from '../index.js'
import { IdClockLive } from './identity.js'
import { sweepOnce, sweepOnceWithLeadership } from './sweeper.js'
import {
  InProcessSweeperLeadershipLive,
  SweeperLeadership,
} from './sweeper-leadership.js'

const Runtime = Layer.mergeAll(AppLive, IdClockLive)
const NoLeadership = Layer.succeed(SweeperLeadership, {
  run: () => Effect.succeed(Option.none()),
})

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
    expect(result.prunedEvents).toBe(0)
  })

  it('does not mutate state when another replica holds leadership', async () => {
    const program = Effect.gen(function* () {
      const leases = yield* LeaseService

      yield* leases.request({
        id: Schema.decodeUnknownSync(LeaseId)('lease_not_leader'),
        payload: stalePayload,
        now: Schema.decodeUnknownSync(Timestamp)('2000-01-01T00:00:00.000Z'),
      })

      const result = yield* sweepOnceWithLeadership
      const stored = yield* leases.get(
        Schema.decodeUnknownSync(LeaseId)('lease_not_leader'),
      )
      return { result, stored }
    }).pipe(Effect.provide(Layer.mergeAll(Runtime, NoLeadership)))

    const { result, stored } = await Effect.runPromise(program)

    expect(Option.isNone(result)).toBe(true)
    expect(Option.getOrNull(stored)?.state).toBe('active')
  })

  it('runs the sweep when local leadership is granted', async () => {
    const program = Effect.gen(function* () {
      const leases = yield* LeaseService

      yield* leases.request({
        id: Schema.decodeUnknownSync(LeaseId)('lease_local_leader'),
        payload: stalePayload,
        now: Schema.decodeUnknownSync(Timestamp)('2000-01-01T00:00:00.000Z'),
      })

      const result = yield* sweepOnceWithLeadership
      const stored = yield* leases.get(
        Schema.decodeUnknownSync(LeaseId)('lease_local_leader'),
      )
      return { result, stored }
    }).pipe(
      Effect.provide(Layer.mergeAll(Runtime, InProcessSweeperLeadershipLive)),
    )

    const { result, stored } = await Effect.runPromise(program)

    expect(Option.getOrNull(result)?.expiredLeases.map((l) => l.id)).toEqual([
      'lease_local_leader',
    ])
    expect(Option.getOrNull(stored)?.state).toBe('expired')
  })

  it('prunes events older than the configured retention window', async () => {
    const eventDraft = (workspace: string, timestamp: string) => {
      const full = Schema.decodeUnknownSync(Event)({
        id: `event_${timestamp}`,
        type: 'work.progressed',
        workspace_id: workspace,
        actor: 'agent_claude_code',
        timestamp,
        seq: 0,
        data: {},
      })
      return {
        id: full.id,
        type: full.type,
        workspace_id: full.workspace_id,
        work_id: full.work_id,
        actor: full.actor,
        timestamp: full.timestamp,
        data: full.data,
      }
    }

    const program = Effect.gen(function* () {
      const events = yield* EventStore
      // Far older than the 1h/30-day defaults; the newest is "now".
      yield* events.append(
        eventDraft('workspace_retain', '2000-01-01T00:00:00Z'),
      )
      const recent = yield* events.append(
        eventDraft('workspace_retain', new Date().toISOString()),
      )
      const result = yield* sweepOnce
      const remaining = yield* events.readAfter('workspace_retain', 0)
      return { result, recent, remaining }
    }).pipe(Effect.provide(Runtime))

    const { result, recent, remaining } = await Effect.runPromise(program)

    expect(result.prunedEvents).toBe(1)
    expect(Chunk.toReadonlyArray(remaining).map((e) => e.id)).toEqual([
      recent.id,
    ])
  })
})
