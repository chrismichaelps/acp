/** @Acp.App.Server.IdClock.Test — id + timestamp minting */
import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { IdClock, IdClockLive } from './identity.js'

const runSync = <A, E>(program: Effect.Effect<A, E, IdClock>): A =>
  Effect.runSync(Effect.provide(program, IdClockLive))

describe('IdClock', () => {
  it('mints unique, prefixed ids', () => {
    const ids = runSync(
      Effect.gen(function* () {
        const idClock = yield* IdClock
        const a = yield* idClock.nextId('work')
        const b = yield* idClock.nextId('work')
        return [a, b]
      }),
    )

    expect(ids[0]).toMatch(/^work_/)
    expect(ids[1]).toMatch(/^work_/)
    expect(ids[0]).not.toBe(ids[1])
  })

  it('produces an ISO-8601 timestamp', () => {
    const now = runSync(
      Effect.gen(function* () {
        const idClock = yield* IdClock
        return yield* idClock.now
      }),
    )

    expect(() => new Date(now).toISOString()).not.toThrow()
    expect(now).toContain('T')
  })

  it('mints unpredictable, high-entropy secure tokens unrelated to the counter or clock', () => {
    const tokens = runSync(
      Effect.gen(function* () {
        const idClock = yield* IdClock
        // Mint several ordinary ids first so the shared counter/clock state
        // an attacker could observe is not fresh when the tokens are minted.
        yield* idClock.nextId('work')
        yield* idClock.nextId('work')
        const a = yield* idClock.secureToken('session')
        const b = yield* idClock.secureToken('session')
        return [a, b]
      }),
    )

    for (const token of tokens) {
      expect(token).toMatch(/^session_[0-9a-f]{64}$/)
    }
    // Two tokens minted back-to-back must not share any predictable
    // structure (e.g. a common timestamp/counter-derived segment).
    expect(tokens[0]).not.toBe(tokens[1])
    const [suffixA, suffixB] = tokens.map((t) => t.slice('session_'.length))
    expect(suffixA.slice(0, 8)).not.toBe(suffixB.slice(0, 8))
  })
})
