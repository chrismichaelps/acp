/** @Acp.App.Server.RouteSupport — shared HTTP route boundary helpers */
import {
  Headers,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from '@effect/platform'
import { Effect, Option, Schema } from 'effect'
import { AppConfigTag } from '../../config/app-config.js'
import { SessionService } from '../../domain/sessions/index.js'
import { toHttpErrorResponse } from '../../infrastructure/http/index.js'
import {
  UnauthorizedError,
  ValidationError,
} from '../../protocol/errors/protocol-error.js'
import type { DomainError } from '../../protocol/errors/protocol-error.js'
import type {
  Permission,
  SessionId,
  WorkerId,
} from '../../protocol/schema/index.js'

const systemActor = 'worker_system' as WorkerId

const domainTags = new Set<string>([
  'ValidationError',
  'NotFoundError',
  'LeaseConflictError',
  'InvalidStateTransitionError',
  'UnauthorizedError',
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

export const authorize = (scope?: Permission) =>
  Effect.gen(function* () {
    const token = yield* bearerToken
    if (token === '') {
      const config = yield* AppConfigTag
      if (config.requireAuth) {
        return yield* Effect.fail(
          new UnauthorizedError({ reason: 'authentication required' }),
        )
      }
      return systemActor
    }
    const sessions = yield* SessionService
    const session = yield* sessions.get(token as SessionId)
    return yield* Option.match(session, {
      onNone: () =>
        Effect.fail(new UnauthorizedError({ reason: 'invalid session token' })),
      onSome: (s) =>
        scope === undefined || s.permissions.includes(scope)
          ? Effect.succeed(s.worker_id)
          : Effect.fail(
              new UnauthorizedError({
                reason: `session lacks scope: ${scope}`,
              }),
            ),
    })
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

export const respond = <E, R>(
  effect: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
) => Effect.catchAll(effect, (error) => Effect.succeed(errorToResponse(error)))

export const ok =
  (status: number) =>
  <A, I>(schema: Schema.Schema<A, I>, value: A) =>
    Effect.map(Schema.encode(schema)(value), (encoded) =>
      HttpServerResponse.unsafeJson(encoded, { status }),
    )

export const pathParam = (key: string) =>
  Effect.map(HttpRouter.params, (params) => params[key] ?? '')
