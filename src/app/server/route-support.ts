/** @Acp.App.Server.RouteSupport — shared HTTP route boundary helpers */
import {
  Headers,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from '@effect/platform'
import { Clock, Effect, Either, Option, Schema } from 'effect'
import { AppConfigTag } from '../../config/app-config.js'
import { SessionService } from '../../domain/sessions/index.js'
import { toHttpErrorResponse } from '../../infrastructure/http/index.js'
import {
  toProtocolError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
} from '../../protocol/errors/protocol-error.js'
import type { DomainError } from '../../protocol/errors/protocol-error.js'
import type { ErrorCode } from '../../protocol/schema/error.schema.js'
import type {
  Permission,
  Session,
  SessionId,
  WorkerId,
  WorkspaceId,
} from '../../protocol/schema/index.js'

const systemActor = 'worker_system' as WorkerId

const domainTags = new Set<string>([
  'ValidationError',
  'NotFoundError',
  'ClaimConflictError',
  'LeaseConflictError',
  'InvalidStateTransitionError',
  'UnauthorizedError',
  'ForbiddenError',
  'UnsupportedCapabilityError',
  'StorageError',
])

const bearerToken = Effect.map(HttpServerRequest.HttpServerRequest, (req) =>
  Option.match(Headers.get(req.headers, 'authorization'), {
    onNone: () => '',
    onSome: (header) =>
      header.toLowerCase().startsWith('bearer ')
        ? header.slice('bearer '.length).trim()
        : '',
  }),
)

export interface AuthorizedActor {
  readonly worker_id: WorkerId
  readonly permissions: readonly Permission[]
  readonly workspace_ids: Session['workspace_ids']
}

const hasScope = (session: Session, scope?: Permission) =>
  scope === undefined || session.permissions.includes(scope)

const hasWorkspace = (
  workspaceIds: Session['workspace_ids'],
  workspaceId: WorkspaceId,
) =>
  Option.match(workspaceIds, {
    onNone: () => true,
    onSome: (workspaceIds) => workspaceIds.includes(workspaceId),
  })

const hasWorkspaceBinding = (workspaceIds: Session['workspace_ids']) =>
  Option.match(workspaceIds, {
    onNone: () => false,
    onSome: (ids) => ids.length > 0,
  })

export const requireSessionWorkspaceBinding = (
  workspaceIds: Session['workspace_ids'],
) =>
  Effect.gen(function* () {
    const config = yield* AppConfigTag
    if (!config.requireWorkspaceBindings || hasWorkspaceBinding(workspaceIds)) {
      return
    }

    return yield* Effect.fail(
      new ValidationError({
        issues: [
          'workspace_ids must include at least one workspace when workspace-bound sessions are required',
        ],
      }),
    )
  })

export const authorizeActor = (scope?: Permission) =>
  Effect.gen(function* () {
    const token = yield* bearerToken
    if (token === '') {
      const config = yield* AppConfigTag
      if (config.requireAuth) {
        return yield* Effect.fail(
          new UnauthorizedError({ reason: 'authentication required' }),
        )
      }
      return {
        worker_id: systemActor,
        permissions: [],
        workspace_ids: Option.none(),
      } satisfies AuthorizedActor
    }
    const sessions = yield* SessionService
    const session = yield* sessions.get(token as SessionId)
    return yield* Option.match(session, {
      onNone: () =>
        Effect.fail(new UnauthorizedError({ reason: 'invalid session token' })),
      onSome: (s) =>
        hasScope(s, scope)
          ? Effect.succeed({
              worker_id: s.worker_id,
              permissions: s.permissions,
              workspace_ids: s.workspace_ids,
            } satisfies AuthorizedActor)
          : Effect.fail(
              new ForbiddenError({
                reason: `session lacks scope: ${String(scope)}`,
              }),
            ),
    })
  })

export const authorize = (scope?: Permission) =>
  Effect.map(authorizeActor(scope), (actor) => actor.worker_id)

export const authorizeWorkspace = (
  scope: Permission,
  workspaceId: WorkspaceId,
) =>
  Effect.gen(function* () {
    const actor = yield* authorizeActor(scope)
    if (Option.isNone(actor.workspace_ids)) {
      return actor.worker_id
    }

    if (hasWorkspace(actor.workspace_ids, workspaceId)) {
      return actor.worker_id
    }

    return yield* Effect.fail(
      new ForbiddenError({ reason: 'session is not scoped to workspace' }),
    )
  })

const errorToResponse = (
  error: unknown,
): HttpServerResponse.HttpServerResponse => {
  const tag = (error as { readonly _tag?: string })._tag
  if (tag !== undefined && domainTags.has(tag)) {
    return toHttpErrorResponse(error as DomainError)
  }
  if (tag === 'ParseError' || tag === 'RequestError') {
    return toHttpErrorResponse(new ValidationError({ issues: [String(error)] }))
  }
  return HttpServerResponse.unsafeJson(
    { error: { code: 'internal_error', message: 'Internal error.' } },
    { status: 500 },
  )
}

interface RouteTelemetry {
  readonly method: string
  readonly route: string
}

const routeTelemetry = (label: string): RouteTelemetry => {
  const [method = 'UNKNOWN', route = label] = label.split(' ', 2)
  return { method, route }
}

const errorCode = (error: unknown): ErrorCode => {
  const tag = (error as { readonly _tag?: string })._tag
  if (tag !== undefined && domainTags.has(tag)) {
    return toProtocolError(error as DomainError).body.error.code
  }
  if (tag === 'ParseError' || tag === 'RequestError') {
    return 'invalid_request'
  }
  return 'internal_error'
}

const logHttpRequest = (
  metadata: RouteTelemetry,
  response: HttpServerResponse.HttpServerResponse,
  startedAt: number,
  code?: ErrorCode,
) =>
  Effect.gen(function* () {
    const finishedAt = yield* Clock.currentTimeMillis
    const annotations = {
      http_method: metadata.method,
      http_route: metadata.route,
      http_status: response.status,
      duration_ms: finishedAt - startedAt,
      ...(code === undefined ? {} : { error_code: code }),
    }
    const log =
      response.status >= 500
        ? Effect.logError('http request completed')
        : response.status >= 400
          ? Effect.logWarning('http request completed')
          : Effect.logInfo('http request completed')
    yield* log.pipe(Effect.annotateLogs(annotations))
  })

export const respond =
  (route: string) =>
  <E, R>(effect: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
    Effect.gen(function* () {
      const metadata = routeTelemetry(route)
      const startedAt = yield* Clock.currentTimeMillis
      const result = yield* Effect.either(effect)
      const response = Either.isLeft(result)
        ? errorToResponse(result.left)
        : result.right
      const code = Either.isLeft(result) ? errorCode(result.left) : undefined
      yield* logHttpRequest(metadata, response, startedAt, code)
      return response
    })

export const ok =
  (status: number) =>
  <A, I>(schema: Schema.Schema<A, I>, value: A) =>
    Effect.map(Schema.encode(schema)(value), (encoded) =>
      HttpServerResponse.unsafeJson(encoded, { status }),
    )

export const pathParam = (key: string) =>
  Effect.map(HttpRouter.params, (params) => params[key] ?? '')
