/** @Acp.Domain.Checkpoints.Service — append-only resume points */
import { Chunk, Context, Effect, Layer, Option, Schema } from 'effect'
import { EventStore } from '../events/index.js'
import { Storage } from '../../infrastructure/storage/index.js'
import { StorageError } from '../../protocol/errors/protocol-error.js'
import { Checkpoint, Event } from '../../protocol/schema/index.js'
import type {
  CheckpointId,
  CreateCheckpointPayload,
  EventType,
  Timestamp,
  WorkerId,
  WorkspaceId,
  WorkId,
} from '../../protocol/schema/index.js'

export interface CreateCheckpointInput {
  readonly id: CheckpointId
  readonly payload: CreateCheckpointPayload
  readonly createdBy: WorkerId
  readonly now: Timestamp
}

export interface CheckpointServiceApi {
  readonly create: (
    input: CreateCheckpointInput,
  ) => Effect.Effect<Checkpoint, StorageError>
  readonly get: (
    checkpointId: CheckpointId,
  ) => Effect.Effect<Option.Option<Checkpoint>, StorageError>
  readonly listForWork: (
    workId: WorkId,
  ) => Effect.Effect<readonly Checkpoint[], StorageError>
  readonly listForWorkspace: (
    workspaceId: WorkspaceId,
  ) => Effect.Effect<readonly Checkpoint[], StorageError>
  readonly latestForWork: (
    workId: WorkId,
  ) => Effect.Effect<Option.Option<Checkpoint>, StorageError>
}

export class CheckpointService extends Context.Tag('CheckpointService')<
  CheckpointService,
  CheckpointServiceApi
>() {}

const collection = 'checkpoint'

const decodeStoredCheckpoint = (value: unknown) =>
  Schema.decodeUnknown(Checkpoint)(value).pipe(
    Effect.mapError(
      (error) =>
        new StorageError({
          op: 'decode_checkpoint',
          cause: String(error),
        }),
    ),
  )

const newestFirst = (left: Checkpoint, right: Checkpoint) =>
  Date.parse(right.created_at) - Date.parse(left.created_at)

const make = Effect.gen(function* () {
  const storage = yield* Storage
  const events = yield* EventStore

  const encodeCheckpoint = (checkpoint: Checkpoint) =>
    Schema.encode(Checkpoint)(checkpoint).pipe(
      Effect.mapError(
        (error) =>
          new StorageError({
            op: 'encode_checkpoint',
            cause: String(error),
          }),
      ),
    )

  const save = (checkpoint: Checkpoint) =>
    Effect.flatMap(encodeCheckpoint(checkpoint), (encoded) =>
      storage.put(collection, checkpoint.id, encoded),
    )

  const appendCheckpointEvent = (
    checkpoint: Checkpoint,
    actor: WorkerId,
    timestamp: Timestamp,
    type: EventType,
  ) =>
    Effect.flatMap(
      Schema.decodeUnknown(Event)({
        id: `event_${checkpoint.id}_${type}_${timestamp}`,
        type,
        workspace_id: checkpoint.workspace_id,
        work_id: checkpoint.work_id,
        actor,
        timestamp,
        seq: 0,
        data: {
          checkpoint_id: checkpoint.id,
          summary: checkpoint.summary,
        },
      }).pipe(
        Effect.mapError(
          (error) =>
            new StorageError({
              op: 'decode_checkpoint_event',
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

  const get: CheckpointServiceApi['get'] = (checkpointId) =>
    Effect.flatMap(storage.get(collection, checkpointId), (stored) =>
      Option.match(stored, {
        onNone: () => Effect.succeed(Option.none<Checkpoint>()),
        onSome: (value) =>
          Effect.map(decodeStoredCheckpoint(value), Option.some),
      }),
    )

  const queryDecoded = (field: 'work_id' | 'workspace_id', value: string) =>
    Effect.flatMap(storage.queryBy(collection, [{ field, value }]), (stored) =>
      Effect.forEach(Chunk.toReadonlyArray(stored), decodeStoredCheckpoint),
    )

  const listForWork: CheckpointServiceApi['listForWork'] = (workId) =>
    Effect.map(queryDecoded('work_id', workId), (checkpoints) =>
      [...checkpoints].sort(newestFirst),
    )

  const listForWorkspace: CheckpointServiceApi['listForWorkspace'] = (
    workspaceId,
  ) =>
    Effect.map(queryDecoded('workspace_id', workspaceId), (checkpoints) =>
      [...checkpoints].sort(newestFirst),
    )

  const create: CheckpointServiceApi['create'] = (input) => {
    const checkpoint: Checkpoint = {
      id: input.id,
      work_id: input.payload.work_id,
      workspace_id: input.payload.workspace_id,
      created_by: input.createdBy,
      summary: input.payload.summary,
      completed_steps: input.payload.completed_steps,
      remaining_steps: input.payload.remaining_steps,
      modified_resources: input.payload.modified_resources,
      created_at: input.now,
    }

    return Effect.gen(function* () {
      yield* save(checkpoint)
      yield* appendCheckpointEvent(
        checkpoint,
        input.createdBy,
        input.now,
        'checkpoint.created',
      )
      return checkpoint
    })
  }

  const latestForWork: CheckpointServiceApi['latestForWork'] = (workId) =>
    Effect.map(listForWork(workId), (checkpoints) =>
      Option.fromNullable(checkpoints[0]),
    )

  return {
    create,
    get,
    listForWork,
    listForWorkspace,
    latestForWork,
  } satisfies CheckpointServiceApi
})

export const CheckpointServiceLive: Layer.Layer<
  CheckpointService,
  never,
  Storage | EventStore
> = Layer.effect(CheckpointService, make)
