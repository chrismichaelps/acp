/** @Acp.Infra.Rpc.Auth — native RPC bearer authorization */
import { Headers } from '@effect/platform'
import { Context, Effect, Option } from 'effect'
import { AppConfigTag } from '../../config/app-config.js'
import { SessionService } from '../../domain/sessions/index.js'
import {
  ForbiddenError,
  UnauthorizedError,
} from '../../protocol/errors/protocol-error.js'
import type {
  Permission,
  ProtocolError,
  SessionId,
  WorkerId,
} from '../../protocol/schema/index.js'
import { toRpcError } from './rpc-error.js'

const systemActor = 'worker_system' as WorkerId

export const AcpRpcActor = Context.GenericTag<WorkerId>('@acp/rpc/Actor')

const bearerToken = (headers: Headers.Headers): string =>
  Option.match(Headers.get(headers, 'authorization'), {
    onNone: () => '',
    onSome: (header) =>
      header.toLowerCase().startsWith('bearer ')
        ? header.slice('bearer '.length).trim()
        : '',
  })

export const authorizeRpc = (
  headers: Headers.Headers,
  scope?: Permission,
): Effect.Effect<WorkerId, ProtocolError, AppConfigTag | SessionService> =>
  Effect.gen(function* () {
    const token = bearerToken(headers)
    if (token === '') {
      const config = yield* AppConfigTag
      if (config.requireAuth) {
        return yield* Effect.fail(
          toRpcError(
            new UnauthorizedError({ reason: 'authentication required' }),
          ),
        )
      }
      return systemActor
    }

    const sessions = yield* SessionService
    const session = yield* sessions
      .get(token as SessionId)
      .pipe(Effect.mapError(toRpcError))
    return yield* Option.match(session, {
      onNone: () =>
        Effect.fail(
          toRpcError(
            new UnauthorizedError({ reason: 'invalid session token' }),
          ),
        ),
      onSome: (s) =>
        scope === undefined || s.permissions.includes(scope)
          ? Effect.succeed(s.worker_id)
          : Effect.fail(
              toRpcError(
                new ForbiddenError({
                  reason: `session lacks scope: ${scope}`,
                }),
              ),
            ),
    })
  })

export const rpcActor = (
  headers: Headers.Headers,
  scope?: Permission,
): Effect.Effect<WorkerId, ProtocolError, AppConfigTag | SessionService> =>
  Effect.gen(function* () {
    const actor = yield* Effect.serviceOption(AcpRpcActor)
    if (Option.isSome(actor)) {
      return actor.value
    }
    return yield* authorizeRpc(headers, scope)
  })
