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
})
