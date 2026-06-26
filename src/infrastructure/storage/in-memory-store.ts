/** @Acp.Infra.Storage.InMemory — Ref-guarded in-memory adapter */
import { Chunk, Effect, HashMap, Layer, Option, Ref } from 'effect'
import { Storage } from './storage.js'
import type { StorageApi } from './storage.js'
import type { Event } from '../../protocol/schema/index.js'

const make = Effect.gen(function* () {
  const collections = yield* Ref.make(
    HashMap.empty<string, HashMap.HashMap<string, unknown>>(),
  )
  const events = yield* Ref.make(HashMap.empty<string, Chunk.Chunk<Event>>())

  const put: StorageApi['put'] = (collection, id, value) =>
    Ref.update(collections, (cs) => {
      const inner = Option.getOrElse(HashMap.get(cs, collection), () =>
        HashMap.empty<string, unknown>(),
      )
      return HashMap.set(cs, collection, HashMap.set(inner, id, value))
    })

  const get: StorageApi['get'] = (collection, id) =>
    Effect.map(Ref.get(collections), (cs) =>
      Option.flatMap(HashMap.get(cs, collection), (inner) =>
        HashMap.get(inner, id),
      ),
    )

  const list: StorageApi['list'] = (collection) =>
    Effect.map(Ref.get(collections), (cs) =>
      Option.match(HashMap.get(cs, collection), {
        onNone: () => Chunk.empty<unknown>(),
        onSome: (inner) => Chunk.fromIterable(HashMap.values(inner)),
      }),
    )

  const remove: StorageApi['remove'] = (collection, id) =>
    Ref.update(collections, (cs) =>
      Option.match(HashMap.get(cs, collection), {
        onNone: () => cs,
        onSome: (inner) =>
          HashMap.set(cs, collection, HashMap.remove(inner, id)),
      }),
    )

  const appendEvent: StorageApi['appendEvent'] = (workspaceId, draft) =>
    Ref.modify(events, (es) => {
      const chunk = Option.getOrElse(HashMap.get(es, workspaceId), () =>
        Chunk.empty<Event>(),
      )
      const full: Event = { ...draft, seq: Chunk.size(chunk) + 1 }
      const next = HashMap.set(es, workspaceId, Chunk.append(chunk, full))
      return [full, next]
    })

  const readEventsAfter: StorageApi['readEventsAfter'] = (
    workspaceId,
    afterSeq,
  ) =>
    Effect.map(Ref.get(events), (es) =>
      Option.match(HashMap.get(es, workspaceId), {
        onNone: () => Chunk.empty<Event>(),
        onSome: (chunk) => Chunk.filter(chunk, (e) => e.seq > afterSeq),
      }),
    )

  return {
    put,
    get,
    list,
    remove,
    appendEvent,
    readEventsAfter,
  } satisfies StorageApi
})

export const InMemoryStorageLive: Layer.Layer<Storage> = Layer.effect(
  Storage,
  make,
)
