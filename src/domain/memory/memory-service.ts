/** @Acp.Domain.Memory.Service — workspace recall records */
import { Chunk, Context, Effect, Layer, Option, Schema } from 'effect'
import { EventStore } from '../events/index.js'
import type { EventStoreApi } from '../events/index.js'
import { Storage } from '../../infrastructure/storage/index.js'
import { StorageError } from '../../protocol/errors/protocol-error.js'
import { Event } from '../../protocol/schema/index.js'
import type {
  CreateMemoryPayload,
  EventType,
  Memory,
  MemoryId,
  ReadMemoryQuery,
  Timestamp,
  WorkerId,
} from '../../protocol/schema/index.js'

export interface CreateMemoryInput {
  readonly id: MemoryId
  readonly payload: CreateMemoryPayload
  readonly createdBy: WorkerId
  readonly now: Timestamp
}

export interface MemoryServiceApi {
  readonly create: (
    input: CreateMemoryInput,
  ) => Effect.Effect<Memory, StorageError>
  readonly read: (
    query: ReadMemoryQuery,
  ) => Effect.Effect<readonly Memory[], StorageError>
}

export class MemoryService extends Context.Tag('MemoryService')<
  MemoryService,
  MemoryServiceApi
>() {}

const appendMemoryEvent = (
  events: EventStoreApi,
  memory: Memory,
  actor: WorkerId,
  timestamp: Timestamp,
  type: EventType,
) =>
  Effect.flatMap(
    Schema.decodeUnknown(Event)({
      id: `event_${memory.id}_${type}_${timestamp}`,
      type,
      workspace_id: memory.workspace_id,
      work_id: Option.getOrNull(memory.work_id),
      actor,
      timestamp,
      seq: 0,
      data: {
        memory_id: memory.id,
        kind: memory.kind,
        key: memory.key,
        summary: memory.summary,
      },
    }).pipe(
      Effect.mapError(
        (error) =>
          new StorageError({
            op: 'decode_memory_event',
            cause: String(error),
          }),
      ),
    ),
    (event) =>
      events.append({
        id: event.id,
        type: event.type,
        workspace_id: event.workspace_id,
        work_id: event.work_id,
        actor: event.actor,
        timestamp: event.timestamp,
        data: event.data,
      }),
  )

const make = Effect.gen(function* () {
  const storage = yield* Storage
  const events = yield* EventStore

  const create: MemoryServiceApi['create'] = (input) =>
    Effect.gen(function* () {
      const memory = yield* storage.appendMemory(input.payload.workspace_id, {
        id: input.id,
        workspace_id: input.payload.workspace_id,
        work_id: input.payload.work_id,
        created_by: input.createdBy,
        kind: input.payload.kind,
        key: input.payload.key,
        summary: input.payload.summary,
        content: input.payload.content,
        labels: input.payload.labels,
        created_at: input.now,
      })
      yield* appendMemoryEvent(
        events,
        memory,
        input.createdBy,
        input.now,
        'memory.created',
      )
      return memory
    })

  const read: MemoryServiceApi['read'] = (query) =>
    Effect.map(storage.readMemory(query), Chunk.toReadonlyArray)

  return {
    create,
    read,
  } satisfies MemoryServiceApi
})

export const MemoryServiceLive: Layer.Layer<
  MemoryService,
  never,
  Storage | EventStore
> = Layer.effect(MemoryService, make)
