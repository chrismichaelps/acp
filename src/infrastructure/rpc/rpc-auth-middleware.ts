/** @Acp.Infra.Rpc.AuthMiddleware — native RPC scope policy middleware */
import { RpcMiddleware } from '@effect/rpc'
import { Context, Effect, Layer, Option } from 'effect'
import { AppConfigTag } from '../../config/app-config.js'
import { SessionService } from '../../domain/sessions/index.js'
import { ProtocolError } from '../../protocol/schema/index.js'
import type { Permission } from '../../protocol/schema/index.js'
import { AcpRpcActor, authorizeRpc } from './rpc-auth.js'

export const AcpRpcRequiredScope = Context.GenericTag<Permission | undefined>(
  '@acp/rpc/RequiredScope',
)

export class AcpRpcAuthMiddleware extends RpcMiddleware.Tag<AcpRpcAuthMiddleware>()(
  '@acp/rpc/AuthMiddleware',
  { failure: ProtocolError, provides: AcpRpcActor },
) {}

export const AcpRpcAuthMiddlewareLive = Layer.effect(
  AcpRpcAuthMiddleware,
  Effect.gen(function* () {
    const config = yield* AppConfigTag
    const sessions = yield* SessionService
    return (options) => {
      const scope = Option.getOrUndefined(
        Context.getOption(options.rpc.annotations, AcpRpcRequiredScope),
      )
      return authorizeRpc(options.headers, scope).pipe(
        Effect.provideService(AppConfigTag, config),
        Effect.provideService(SessionService, sessions),
      )
    }
  }),
)
