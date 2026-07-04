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
  Session,
  SessionId,
  WorkerId,
  WorkspaceId,
} from '../../protocol/schema/index.js'
import { toRpcError } from './rpc-error.js'

const systemActor = 'worker_system' as WorkerId

export const AcpRpcActor = Context.GenericTag<WorkerId>('@acp/rpc/Actor')

export interface AuthorizedRpcActor {
  readonly worker_id: WorkerId
  readonly permissions: readonly Permission[]
  readonly workspace_ids: Session['workspace_ids']
}

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
  Effect.map(authorizeRpcActor(headers, scope), (actor) => actor.worker_id)

export const authorizeRpcActor = (
  headers: Headers.Headers,
  scope?: Permission,
): Effect.Effect<
  AuthorizedRpcActor,
  ProtocolError,
  AppConfigTag | SessionService
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
          ? Effect.succeed({
              worker_id: s.worker_id,
              permissions: s.permissions,
              workspace_ids: s.workspace_ids,
            } satisfies AuthorizedRpcActor)
          : Effect.fail(
              toRpcError(
                new ForbiddenError({
                  reason: `session lacks scope: ${scope}`,
                }),
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
): Effect.Effect<WorkerId, ProtocolError, AppConfigTag | SessionService> =>
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
): Effect.Effect<WorkerId, ProtocolError, AppConfigTag | SessionService> =>
  Effect.gen(function* () {
    const actor = yield* Effect.serviceOption(AcpRpcActor)
    if (Option.isSome(actor)) {
      return actor.value
    }
    return yield* authorizeRpc(headers, scope)
  })

export const rpcWorkspaceActor = (
  headers: Headers.Headers,
  scope: Permission,
  workspaceId: WorkspaceId,
): Effect.Effect<WorkerId, ProtocolError, AppConfigTag | SessionService> =>
  Effect.gen(function* () {
    const actor = yield* Effect.serviceOption(AcpRpcActor)
    if (Option.isSome(actor)) {
      return actor.value
    }
    return yield* authorizeRpcWorkspace(headers, scope, workspaceId)
  })
