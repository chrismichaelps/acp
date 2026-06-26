/** @Acp.App.Server.IdClock — id + timestamp minting for the composition root */
import { Clock, Context, DateTime, Effect, Layer, Ref } from 'effect'
import type { Timestamp } from '../../protocol/schema/index.js'

export interface IdClockApi {
  readonly nextId: (prefix: string) => Effect.Effect<string>
  readonly now: Effect.Effect<Timestamp>
}

export class IdClock extends Context.Tag('IdClock')<IdClock, IdClockApi>() {}

const make = Effect.gen(function* () {
  const counter = yield* Ref.make(0)

  const nextId: IdClockApi['nextId'] = (prefix) =>
    Effect.gen(function* () {
      const n = yield* Ref.updateAndGet(counter, (x) => x + 1)
      const ms = yield* Clock.currentTimeMillis
      return `${prefix}_${ms.toString(36)}${n.toString(36)}`
    })

  const now: IdClockApi['now'] = Effect.map(
    Clock.currentTimeMillis,
    // Timestamp is an unrefined branded string; ISO formatting is the brand's intent.
    (ms) => DateTime.formatIso(DateTime.unsafeMake(ms)) as Timestamp,
  )

  return { nextId, now } satisfies IdClockApi
})

export const IdClockLive: Layer.Layer<IdClock> = Layer.effect(IdClock, make)
