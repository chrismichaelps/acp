/** @Acp.Domain.Workers.Service — Worker registry persistence */
import { Chunk, Context, Effect, Layer, Option, Schema } from 'effect'
import { Storage } from '../../infrastructure/storage/index.js'
import {
  NotFoundError,
  StorageError,
} from '../../protocol/errors/protocol-error.js'
import { Worker } from '../../protocol/schema/index.js'
import type { WorkerId, WorkerStatus } from '../../protocol/schema/index.js'

export interface WorkerServiceApi {
  readonly register: (worker: Worker) => Effect.Effect<Worker, StorageError>
  readonly get: (
    workerId: WorkerId,
  ) => Effect.Effect<Option.Option<Worker>, StorageError>
  readonly list: () => Effect.Effect<readonly Worker[], StorageError>
  readonly setStatus: (
    workerId: WorkerId,
    status: WorkerStatus,
  ) => Effect.Effect<Worker, NotFoundError | StorageError>
}

export class WorkerService extends Context.Tag('WorkerService')<
  WorkerService,
  WorkerServiceApi
>() {}

const collection = 'worker'

const decodeStoredWorker = (value: unknown) =>
  Schema.decodeUnknown(Worker)(value).pipe(
    Effect.mapError(
      (error) =>
        new StorageError({
          op: 'decode_worker',
          cause: String(error),
        }),
    ),
  )

const make = Effect.gen(function* () {
  const storage = yield* Storage

  const encodeWorker = (worker: Worker) =>
    Schema.encode(Worker)(worker).pipe(
      Effect.mapError(
        (error) =>
          new StorageError({
            op: 'encode_worker',
            cause: String(error),
          }),
      ),
    )

  const save = (worker: Worker) =>
    Effect.flatMap(encodeWorker(worker), (encoded) =>
      storage.put(collection, worker.id, encoded),
    )

  const register: WorkerServiceApi['register'] = (worker) =>
    Effect.as(save(worker), worker)

  const get: WorkerServiceApi['get'] = (workerId) =>
    Effect.flatMap(storage.get(collection, workerId), (stored) =>
      Option.match(stored, {
        onNone: () => Effect.succeed(Option.none<Worker>()),
        onSome: (value) => Effect.map(decodeStoredWorker(value), Option.some),
      }),
    )

  const list: WorkerServiceApi['list'] = () =>
    Effect.flatMap(storage.list(collection), (stored) =>
      Effect.forEach(Chunk.toReadonlyArray(stored), decodeStoredWorker),
    )

  const requireWorker = (workerId: WorkerId) =>
    Effect.flatMap(get(workerId), (worker) =>
      Option.match(worker, {
        onNone: () =>
          Effect.fail(new NotFoundError({ entity: 'worker', id: workerId })),
        onSome: Effect.succeed,
      }),
    )

  const setStatus: WorkerServiceApi['setStatus'] = (workerId, status) =>
    Effect.flatMap(requireWorker(workerId), (worker) => {
      const next: Worker = { ...worker, status }
      return Effect.as(save(next), next)
    })

  return {
    register,
    get,
    list,
    setStatus,
  } satisfies WorkerServiceApi
})

export const WorkerServiceLive: Layer.Layer<WorkerService, never, Storage> =
  Layer.effect(WorkerService, make)
