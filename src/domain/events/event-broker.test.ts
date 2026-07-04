/** @Acp.Domain.Events.EventBroker.Test — fan-out seam contract */
import { describe, expect, it } from 'vitest'
import { Effect, Fiber, Option, Schema, Stream } from 'effect'
import { Event } from '../../protocol/schema/index.js'
import { EventBroker, InProcessEventBrokerLive } from './index.js'

const runPromise = <A, E>(
  program: Effect.Effect<A, E, EventBroker>,
): Promise<A> =>
  Effect.runPromise(Effect.provide(program, InProcessEventBrokerLive))

const event = (workspace: string, id = 'event_broker_1'): Event =>
  Schema.decodeUnknownSync(Event)({
    id,
    type: 'work.progressed',
    workspace_id: workspace,
    actor: 'agent_codex',
    timestamp: '2026-07-02T22:00:00Z',
    seq: 1,
    data: {},
  })

describe('InProcess EventBroker', () => {
  it('delivers a published event to a live subscriber (firehose, unfiltered)', async () => {
    const result = await runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const broker = yield* EventBroker
          const stream = yield* broker.subscribe()
          const fiber = yield* Effect.fork(Stream.runHead(stream))

          const published = event('workspace_broker')
          yield* broker.publish(published)

          const observed = yield* Fiber.join(fiber)
          return { published, observed }
        }),
      ),
    )

    expect(Option.getOrNull(result.observed)).toEqual(result.published)
  })

  it('fans one event out to multiple subscribers', async () => {
    const both = await runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const broker = yield* EventBroker
          const first = yield* broker.subscribe()
          const second = yield* broker.subscribe()
          const f1 = yield* Effect.fork(Stream.runHead(first))
          const f2 = yield* Effect.fork(Stream.runHead(second))

          const published = event('workspace_fanout')
          yield* broker.publish(published)

          const a = yield* Fiber.join(f1)
          const b = yield* Fiber.join(f2)
          return [Option.getOrNull(a), Option.getOrNull(b)] as const
        }),
      ),
    )

    expect(both).toEqual([event('workspace_fanout'), event('workspace_fanout')])
  })
})
