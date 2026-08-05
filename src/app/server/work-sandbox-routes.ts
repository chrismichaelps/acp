/** @Acp.App.Server.WorkSandboxRoutes — sandbox lifecycle for a work unit */
import { Effect, Option, Schema } from 'effect'
import { IdClock } from './identity.js'
import { SandboxService } from '../../domain/sandbox/index.js'
import { WorkUnitService } from '../../domain/work-units/index.js'
import { NotFoundError } from '../../protocol/errors/protocol-error.js'
import { Sandbox } from '../../protocol/schema/index.js'
import type { WorkId } from '../../protocol/schema/index.js'
import type { SandboxHandle } from '../../domain/sandbox/index.js'
import { authorizeWorkspace, ok, pathParam, respond } from './route-support.js'

const workIdParam = () =>
  Effect.map(pathParam('work_id'), (workId) => workId as WorkId)

/** Resolves the work unit and authorizes against its workspace. */
const authorizeWork = (
  workId: WorkId,
  scope: 'workspace:read' | 'work:update',
) =>
  Effect.gen(function* () {
    const work = yield* WorkUnitService
    const stored = yield* work.get(workId)
    const found = yield* Option.match(stored, {
      onNone: () =>
        Effect.fail(new NotFoundError({ entity: 'work', id: workId })),
      onSome: Effect.succeed,
    })
    yield* authorizeWorkspace(scope, found.workspace_id)
  })

const toWire = (handle: SandboxHandle): Sandbox => ({
  work_id: handle.workId,
  status: handle.status,
  external_id:
    handle.externalId === undefined
      ? Option.none()
      : Option.some(handle.externalId),
  exit_code:
    handle.exitCode === undefined
      ? Option.none()
      : Option.some(handle.exitCode),
})

export const startWorkSandbox = respond('POST /v1/work/:work_id/sandbox')(
  Effect.gen(function* () {
    const sandbox = yield* SandboxService
    const idClock = yield* IdClock
    const workId = yield* workIdParam()
    // Provisioning mutates the host, so it needs a write scope, not a read.
    yield* authorizeWork(workId, 'work:update')
    const now = yield* idClock.now
    const handle = yield* sandbox.ensure(workId, now)
    return yield* ok(201)(Sandbox, toWire(handle))
  }),
)

export const getWorkSandbox = respond('GET /v1/work/:work_id/sandbox')(
  Effect.gen(function* () {
    const sandbox = yield* SandboxService
    const workId = yield* workIdParam()
    yield* authorizeWork(workId, 'workspace:read')
    const handle = yield* sandbox.status(workId)
    return yield* ok(200)(Sandbox, toWire(handle))
  }),
)

export const stopWorkSandbox = respond('DELETE /v1/work/:work_id/sandbox')(
  Effect.gen(function* () {
    const sandbox = yield* SandboxService
    const workId = yield* workIdParam()
    yield* authorizeWork(workId, 'work:update')
    yield* sandbox.stop(workId)
    return yield* ok(200)(Schema.Struct({ stopped: Schema.Boolean }), {
      stopped: true,
    })
  }),
)
