/** @Acp.Domain.Events.EventStore — persisted event append + live fan-out */
import { Context, Effect, Layer, Stream } from 'effect'
import type { Chunk, Scope } from 'effect'
import { Storage } from '../../infrastructure/storage/index.js'
import type { EventDraft as StorageEventDraft } from '../../infrastructure/storage/index.js'
import type { StorageError } from '../../protocol/errors/protocol-error.js'
import type { Event } from '../../protocol/schema/index.js'
import { EventBroker } from './event-broker.js'

export type EventDraft = StorageEventDraft

export interface EventStoreApi {
  readonly append: (draft: EventDraft) => Effect.Effect<Event, StorageError>
  readonly readAfter: (
    workspaceId: string,
    afterSeq: number,
  ) => Effect.Effect<Chunk.Chunk<Event>, StorageError>
  readonly subscribe: (
    workspaceId: string,
  ) => Effect.Effect<Stream.Stream<Event>, never, Scope.Scope>
  readonly pruneBefore: (cutoff: string) => Effect.Effect<number, StorageError>
}

export class EventStore extends Context.Tag('EventStore')<
  EventStore,
  EventStoreApi
>() {}

const make = Effect.gen(function* () {
  const storage = yield* Storage
  const broker = yield* EventBroker

  const append: EventStoreApi['append'] = (draft) =>
    Effect.gen(function* () {
      const event = yield* storage.appendEvent(draft.workspace_id, draft)
      yield* broker.publish(event)
      return event
    })

  const readAfter: EventStoreApi['readAfter'] = (workspaceId, afterSeq) =>
    storage.readEventsAfter(workspaceId, afterSeq)

  const pruneBefore: EventStoreApi['pruneBefore'] = (cutoff) =>
    storage.pruneEventsBefore(cutoff)

  const subscribe: EventStoreApi['subscribe'] = (workspaceId) =>
    Effect.map(
      broker.subscribe(),
      Stream.filter((event) => event.workspace_id === workspaceId),
    )

  return {
    append,
    readAfter,
    subscribe,
    pruneBefore,
  } satisfies EventStoreApi
})

export const EventStoreLive: Layer.Layer<
  EventStore,
  never,
  Storage | EventBroker
> = Layer.effect(EventStore, make)
