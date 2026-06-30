/** @Acp.App.Server.WorkerRoutes — host-scoped worker read handlers */
import { Effect, Option, Schema } from 'effect'
import { WorkerService } from '../../domain/workers/index.js'
import { NotFoundError } from '../../protocol/errors/protocol-error.js'
import { Worker } from '../../protocol/schema/index.js'
import type { WorkerId } from '../../protocol/schema/index.js'
import { authorize, ok, pathParam, respond } from './route-support.js'

export const listWorkers = respond('GET /v1/workers')(
  Effect.gen(function* () {
    const workers = yield* WorkerService
    yield* authorize('worker:read')
    const all = yield* workers.list()
    return yield* ok(200)(Schema.Array(Worker), all)
  }),
)

export const getWorker = respond('GET /v1/workers/:worker_id')(
  Effect.gen(function* () {
    const workers = yield* WorkerService
    const workerId = (yield* pathParam('worker_id')) as WorkerId
    yield* authorize('worker:read')
    const found = yield* workers.get(workerId)
    const worker = yield* Option.match(found, {
      onNone: () =>
        Effect.fail(new NotFoundError({ entity: 'worker', id: workerId })),
      onSome: Effect.succeed,
    })
    return yield* ok(200)(Worker, worker)
  }),
)
