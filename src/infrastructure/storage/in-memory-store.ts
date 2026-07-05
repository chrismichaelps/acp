/** @Acp.Infra.Storage.InMemory — Ref-guarded in-memory adapter */
import { Chunk, Effect, HashMap, Layer, Option, Ref } from 'effect'
import { Storage } from './storage.js'
import type { StorageApi, StoredRecord } from './storage.js'
import type { Event, Memory } from '../../protocol/schema/index.js'

const sameJsonValue = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right)

const make = Effect.gen(function* () {
  const collections = yield* Ref.make(
    HashMap.empty<string, HashMap.HashMap<string, StoredRecord>>(),
  )
  const events = yield* Ref.make(HashMap.empty<string, Chunk.Chunk<Event>>())
  const memory = yield* Ref.make(HashMap.empty<string, Chunk.Chunk<Memory>>())

  const put: StorageApi['put'] = (collection, id, value) =>
    Ref.update(collections, (cs) => {
      const inner = Option.getOrElse(HashMap.get(cs, collection), () =>
        HashMap.empty<string, StoredRecord>(),
      )
      const existing = Option.getOrUndefined(HashMap.get(inner, id))
      const stored: StoredRecord = {
        value,
        version: (existing?.version ?? 0) + 1,
      }
      return HashMap.set(cs, collection, HashMap.set(inner, id, stored))
    })

  const replaceIf: StorageApi['replaceIf'] = (
    collection,
    id,
    expected,
    value,
  ) =>
    Ref.modify(collections, (cs) => {
      const inner = Option.getOrElse(HashMap.get(cs, collection), () =>
        HashMap.empty<string, StoredRecord>(),
      )
      const current = Option.getOrUndefined(HashMap.get(inner, id))
      if (!sameJsonValue(current?.value, expected)) {
        return [false, cs]
      }
      const stored: StoredRecord = {
        value,
        version: (current?.version ?? 0) + 1,
      }
      return [true, HashMap.set(cs, collection, HashMap.set(inner, id, stored))]
    })

  const putIfAbsent: StorageApi['putIfAbsent'] = (collection, id, value) =>
    Ref.modify(collections, (cs) => {
      const inner = Option.getOrElse(HashMap.get(cs, collection), () =>
        HashMap.empty<string, StoredRecord>(),
      )
      if (Option.isSome(HashMap.get(inner, id))) {
        return [false, cs]
      }
      const stored: StoredRecord = { value, version: 1 }
      return [true, HashMap.set(cs, collection, HashMap.set(inner, id, stored))]
    })

  const get: StorageApi['get'] = (collection, id) =>
    Effect.map(Ref.get(collections), (cs) =>
      Option.map(
        Option.flatMap(HashMap.get(cs, collection), (inner) =>
          HashMap.get(inner, id),
        ),
        (stored) => stored.value,
      ),
    )

  const getVersioned: StorageApi['getVersioned'] = (collection, id) =>
    Effect.map(Ref.get(collections), (cs) =>
      Option.flatMap(HashMap.get(cs, collection), (inner) =>
        HashMap.get(inner, id),
      ),
    )

  const replaceIfVersion: StorageApi['replaceIfVersion'] = (
    collection,
    id,
    expectedVersion,
    value,
  ) =>
    Ref.modify(collections, (cs) => {
      const inner = Option.getOrElse(HashMap.get(cs, collection), () =>
        HashMap.empty<string, StoredRecord>(),
      )
      const current = Option.getOrUndefined(HashMap.get(inner, id))
      if (current?.version !== expectedVersion) {
        return [false, cs]
      }
      const stored: StoredRecord = { value, version: current.version + 1 }
      return [true, HashMap.set(cs, collection, HashMap.set(inner, id, stored))]
    })

  const list: StorageApi['list'] = (collection) =>
    Effect.map(Ref.get(collections), (cs) =>
      Option.match(HashMap.get(cs, collection), {
        onNone: () => Chunk.empty<unknown>(),
        onSome: (inner) =>
          Chunk.map(
            Chunk.fromIterable(HashMap.values(inner)),
            (stored) => stored.value,
          ),
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

  // seq is a per-workspace high-water-mark (max existing seq + 1), not a row
  // count, so pruning old events never lowers it or reuses a seq.
  const maxSeq = (chunk: Chunk.Chunk<Event>): number =>
    Chunk.reduce(chunk, 0, (max, event) => (event.seq > max ? event.seq : max))

  const appendEvent: StorageApi['appendEvent'] = (workspaceId, draft) =>
    Ref.modify(events, (es) => {
      const chunk = Option.getOrElse(HashMap.get(es, workspaceId), () =>
        Chunk.empty<Event>(),
      )
      const full: Event = { ...draft, seq: maxSeq(chunk) + 1 }
      const next = HashMap.set(es, workspaceId, Chunk.append(chunk, full))
      return [full, next]
    })

  const pruneEventsBefore: StorageApi['pruneEventsBefore'] = (cutoff) =>
    Ref.modify(events, (es) => {
      const cutoffMs = Date.parse(cutoff)
      let pruned = 0
      const next = HashMap.map(es, (chunk) => {
        const newest = maxSeq(chunk)
        // Keep the newest event (seq watermark) and anything not yet aged out.
        const kept = Chunk.filter(
          chunk,
          (event) =>
            event.seq >= newest || Date.parse(event.timestamp) >= cutoffMs,
        )
        pruned += Chunk.size(chunk) - Chunk.size(kept)
        return kept
      })
      return [pruned, next]
    })

  const readEventsAfter: StorageApi['readEventsAfter'] = (
    workspaceId,
    afterSeq,
    limit,
  ) =>
    Effect.map(Ref.get(events), (es) =>
      Option.match(HashMap.get(es, workspaceId), {
        onNone: () => Chunk.empty<Event>(),
        onSome: (chunk) =>
          Chunk.take(
            Chunk.filter(chunk, (e) => e.seq > afterSeq),
            Option.getOrElse(
              limit ?? Option.none(),
              () => Number.MAX_SAFE_INTEGER,
            ),
          ),
      }),
    )

  const appendMemory: StorageApi['appendMemory'] = (workspaceId, draft) =>
    Ref.modify(memory, (ms) => {
      const chunk = Option.getOrElse(HashMap.get(ms, workspaceId), () =>
        Chunk.empty<Memory>(),
      )
      const full: Memory = { ...draft, seq: Chunk.size(chunk) + 1 }
      const next = HashMap.set(ms, workspaceId, Chunk.append(chunk, full))
      return [full, next]
    })

  const readMemory: StorageApi['readMemory'] = (query) =>
    Effect.map(Ref.get(memory), (ms) => {
      const limit = Option.getOrElse(query.limit, () => 100)
      const chunk = Option.getOrElse(HashMap.get(ms, query.workspace_id), () =>
        Chunk.empty<Memory>(),
      )
      return Chunk.take(
        Chunk.filter(
          chunk,
          (record) =>
            record.seq > query.after_seq &&
            Option.match(query.work_id, {
              onNone: () => true,
              onSome: (workId) =>
                Option.match(record.work_id, {
                  onNone: () => false,
                  onSome: (recordWorkId) => recordWorkId === workId,
                }),
            }) &&
            Option.match(query.kind, {
              onNone: () => true,
              onSome: (kind) => record.kind === kind,
            }) &&
            Option.match(query.key, {
              onNone: () => true,
              onSome: (key) => record.key === key,
            }) &&
            Option.match(query.label, {
              onNone: () => true,
              onSome: (label) => record.labels.includes(label),
            }),
        ),
        limit,
      )
    })

  return {
    put,
    putIfAbsent,
    replaceIf,
    get,
    getVersioned,
    replaceIfVersion,
    list,
    remove,
    appendEvent,
    readEventsAfter,
    pruneEventsBefore,
    appendMemory,
    readMemory,
  } satisfies StorageApi
})

export const InMemoryStorageLive: Layer.Layer<Storage> = Layer.effect(
  Storage,
  make,
)
