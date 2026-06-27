/** @Acp.Domain.Sessions.Service.Test — Session registry + actor resolution */
import { describe, expect, it } from 'vitest'
import { Effect, Layer, Option, Schema } from 'effect'
import { InMemoryStorageLive } from '../../infrastructure/storage/index.js'
import { Session, SessionId } from '../../protocol/schema/index.js'
import { SessionService, SessionServiceLive } from './index.js'

const TestLive = Layer.provideMerge(SessionServiceLive, InMemoryStorageLive)

const runSync = <A, E>(program: Effect.Effect<A, E, SessionService>): A =>
  Effect.runSync(Effect.provide(program, TestLive))

const sessionId = Schema.decodeUnknownSync(SessionId)('session_abc123')

const decodeSession = () =>
  Schema.decodeUnknownSync(Session)({
    id: 'session_abc123',
    worker_id: 'agent_claude_code',
    created_at: '2026-06-26T00:00:00.000Z',
  })

describe('SessionService', () => {
  it('creates a session and reads it back', () => {
    const result = runSync(
      Effect.gen(function* () {
        const sessions = yield* SessionService
        const created = yield* sessions.create(decodeSession())
        const stored = yield* sessions.get(sessionId)
        return { created, stored }
      }),
    )

    expect(result.created.id).toBe(sessionId)
    expect(Option.getOrNull(result.stored)).toEqual(result.created)
  })

  it('resolves the actor (worker_id) from a session token', () => {
    const actor = runSync(
      Effect.gen(function* () {
        const sessions = yield* SessionService
        yield* sessions.create(decodeSession())
        return yield* sessions.resolveActor('session_abc123')
      }),
    )

    expect(Option.getOrNull(actor)).toBe('agent_claude_code')
  })

  it('resolves Option.none for an unknown token', () => {
    const actor = runSync(
      Effect.gen(function* () {
        const sessions = yield* SessionService
        return yield* sessions.resolveActor('session_missing')
      }),
    )

    expect(Option.isNone(actor)).toBe(true)
  })
})
