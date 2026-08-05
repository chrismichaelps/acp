/** @Acp.App.Server.WorkGraphRoutes — spawn graph read handlers */
import { HttpServerRequest } from '@effect/platform'
import { Effect, Option, Schema } from 'effect'
import { WorkUnitService } from '../../domain/work-units/index.js'
import {
  NotFoundError,
  ValidationError,
} from '../../protocol/errors/protocol-error.js'
import { WorkUnit } from '../../protocol/schema/index.js'
import type { WorkId } from '../../protocol/schema/index.js'
import { authorizeWorkspace, ok, pathParam, respond } from './route-support.js'

const workIdParam = () =>
  Effect.map(pathParam('work_id'), (workId) => workId as WorkId)

/**
 * Resolves the work unit and authorizes against its workspace. Reading a
 * subtree is a workspace read, so it carries the same scope as listing work.
 */
const requireAuthorizedWork = (workId: WorkId) =>
  Effect.gen(function* () {
    const service = yield* WorkUnitService
    const stored = yield* service.get(workId)
    const found = yield* Option.match(stored, {
      onNone: () =>
        Effect.fail(new NotFoundError({ entity: 'work', id: workId })),
      onSome: Effect.succeed,
    })
    yield* authorizeWorkspace('workspace:read', found.workspace_id)
    return service
  })

/**
 * Parses a positive-integer query parameter. An unparseable or non-positive
 * value is rejected rather than silently coerced, so a typo cannot quietly
 * change how much of a subtree the caller sees.
 */
const positiveIntParam = (
  params: URLSearchParams,
  name: string,
): Effect.Effect<Option.Option<number>, ValidationError> => {
  const raw = params.get(name)
  if (raw === null) return Effect.succeed(Option.none())
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0
    ? Effect.succeed(Option.some(parsed))
    : Effect.fail(
        new ValidationError({
          issues: [`${name} must be a positive integer, got "${raw}"`],
        }),
      )
}

export const listWorkChildren = respond('GET /v1/work/:work_id/children')(
  Effect.gen(function* () {
    const workId = yield* workIdParam()
    const service = yield* requireAuthorizedWork(workId)
    const children = yield* service.listChildren(workId)
    return yield* ok(200)(Schema.Array(WorkUnit), children)
  }),
)

export const listWorkDescendants = respond('GET /v1/work/:work_id/descendants')(
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest
    const params = new URL(request.url, 'http://acp.local').searchParams
    const workId = yield* workIdParam()
    const service = yield* requireAuthorizedWork(workId)
    const maxDepth = yield* positiveIntParam(params, 'max_depth')
    const limit = yield* positiveIntParam(params, 'limit')
    const descendants = yield* service.listDescendants(workId, {
      ...(Option.isSome(maxDepth) ? { maxDepth: maxDepth.value } : {}),
      ...(Option.isSome(limit) ? { limit: limit.value } : {}),
    })
    return yield* ok(200)(Schema.Array(WorkUnit), descendants)
  }),
)
