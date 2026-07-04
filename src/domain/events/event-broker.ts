/** @Acp.Domain.Events.EventBroker — transport-agnostic event fan-out seam */
import { Context, Effect, Layer, PubSub, Stream } from 'effect'
import type { Scope } from 'effect'
import type { Event } from '../../protocol/schema/index.js'

/**
 * The fan-out port behind {@link EventStore}. `publish` broadcasts a persisted
 * event; `subscribe` returns a scoped firehose `Stream` of every published event.
 * Workspace filtering is domain logic and stays in {@link EventStore}, so a
 * broker adapter only moves bytes between processes.
 *
 * Adapters: `in-process` (Effect `PubSub`, single node) and `pg-notify`
 * (Postgres `LISTEN/NOTIFY`) today; `redis` can fit behind the same Tag later
 * for deployments that choose a second broker dependency.
 */
export interface EventBrokerApi {
  readonly publish: (event: Event) => Effect.Effect<void>
  readonly subscribe: () => Effect.Effect<
    Stream.Stream<Event>,
    never,
    Scope.Scope
  >
}

export class EventBroker extends Context.Tag('EventBroker')<
  EventBroker,
  EventBrokerApi
>() {}

const makeInProcess = Effect.gen(function* () {
  const pubsub = yield* PubSub.unbounded<Event>()

  const publish: EventBrokerApi['publish'] = (event) =>
    Effect.asVoid(PubSub.publish(pubsub, event))

  const subscribe: EventBrokerApi['subscribe'] = () =>
    Stream.fromPubSub(pubsub, { scoped: true })

  return { publish, subscribe } satisfies EventBrokerApi
})

/** In-process fan-out over an Effect `PubSub`. Process-local (single node). */
export const InProcessEventBrokerLive: Layer.Layer<EventBroker> = Layer.effect(
  EventBroker,
  makeInProcess,
)
