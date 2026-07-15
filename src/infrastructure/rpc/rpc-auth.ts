/** @Acp.Infra.Rpc.Auth — native RPC bearer authorization */
import { Headers } from '@effect/platform'
import { Context, Effect, Option } from 'effect'
import { AppConfigTag } from '../../config/app-config.js'
import { SessionIssuer, SessionService } from '../../domain/sessions/index.js'
import {
  ForbiddenError,
  UnauthorizedError,
} from '../../protocol/errors/protocol-error.js'
import type {
  Permission,
  ProtocolError,
  Session,
  SessionId,
  WorkerId,
  WorkspaceId,
} from '../../protocol/schema/index.js'
import { toRpcError } from './rpc-error.js'

const systemActor = 'worker_system' as WorkerId

export interface AuthorizedRpcActor {
  readonly worker_id: WorkerId
  readonly permissions: readonly Permission[]
  readonly workspace_ids: Session['workspace_ids']
}

export const AcpRpcActor =
  Context.GenericTag<AuthorizedRpcActor>('@acp/rpc/Actor')

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
): Effect.Effect<
  WorkerId,
  ProtocolError,
  AppConfigTag | SessionIssuer | SessionService
> => Effect.map(authorizeRpcActor(headers, scope), (actor) => actor.worker_id)

export const authorizeRpcActor = (
  headers: Headers.Headers,
  scope?: Permission,
): Effect.Effect<
  AuthorizedRpcActor,
  ProtocolError,
  AppConfigTag | SessionIssuer | SessionService
> =>
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
      return {
        worker_id: systemActor,
        permissions: [],
        workspace_ids: Option.none(),
      } satisfies AuthorizedRpcActor
    }

    const sessions = yield* SessionService
    const issuer = yield* SessionIssuer
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
        issuer.validate(s).pipe(
          Effect.mapError(toRpcError),
          Effect.flatMap((validated) =>
            scope === undefined || validated.permissions.includes(scope)
              ? Effect.succeed({
                  worker_id: validated.worker_id,
                  permissions: validated.permissions,
                  workspace_ids: validated.workspace_ids,
                } satisfies AuthorizedRpcActor)
              : Effect.fail(
                  toRpcError(
                    new ForbiddenError({
                      reason: `session lacks scope: ${scope}`,
                    }),
                  ),
                ),
          ),
        ),
    })
  })

const hasWorkspace = (
  workspaceIds: Session['workspace_ids'],
  workspaceId: WorkspaceId,
) =>
  Option.match(workspaceIds, {
    onNone: () => true,
    onSome: (workspaceIds) => workspaceIds.includes(workspaceId),
  })

export const authorizeRpcWorkspace = (
  headers: Headers.Headers,
  scope: Permission,
  workspaceId: WorkspaceId,
): Effect.Effect<
  WorkerId,
  ProtocolError,
  AppConfigTag | SessionIssuer | SessionService
> =>
  Effect.gen(function* () {
    const actor = yield* authorizeRpcActor(headers, scope)
    if (hasWorkspace(actor.workspace_ids, workspaceId)) {
      return actor.worker_id
    }

    return yield* Effect.fail(
      toRpcError(
        new ForbiddenError({ reason: 'session is not scoped to workspace' }),
      ),
    )
  })

export const rpcActor = (
  headers: Headers.Headers,
  scope?: Permission,
): Effect.Effect<
  WorkerId,
  ProtocolError,
  AppConfigTag | SessionIssuer | SessionService
> =>
  Effect.gen(function* () {
    const actor = yield* Effect.serviceOption(AcpRpcActor)
    if (Option.isSome(actor)) {
      return actor.value.worker_id
    }
    return yield* authorizeRpc(headers, scope)
  })

export const rpcWorkspaceActor = (
  headers: Headers.Headers,
  scope: Permission,
  workspaceId: WorkspaceId,
): Effect.Effect<
  WorkerId,
  ProtocolError,
  AppConfigTag | SessionIssuer | SessionService
> =>
  Effect.gen(function* () {
    const actor = yield* Effect.serviceOption(AcpRpcActor)
    if (Option.isSome(actor)) {
      if (hasWorkspace(actor.value.workspace_ids, workspaceId)) {
        return actor.value.worker_id
      }
      return yield* Effect.fail(
        toRpcError(
          new ForbiddenError({
            reason: 'session is not scoped to workspace',
          }),
        ),
      )
    }
    return yield* authorizeRpcWorkspace(headers, scope, workspaceId)
  })
