/** @Acp.Infra.Rpc.Server — dependency-complete native RPC handler runtime */
import { Layer } from 'effect'
import { AppLive } from '../../app/index.js'
import { IdClockLive } from '../../app/server/identity.js'
import { AcpRpcSessionWorkerWorkspaceHandlersLive } from './acp-rpc-handlers.js'
import { AcpRpcAuthMiddlewareLive } from './rpc-auth-middleware.js'

// The native RPC handler set without application dependencies filled. Host
// composition uses this variant so REST, legacy JSON-RPC, WebSocket JSON-RPC,
// and native RPC all share the same AppLive/Storage instance.
export const AcpRpcHandlersLayer = Layer.mergeAll(
  AcpRpcSessionWorkerWorkspaceHandlersLive,
  AcpRpcAuthMiddlewareLive,
)

// Dependency-complete server-side layer for standalone transports and focused
// round-trip tests. It remains useful outside the host, where there is no
// surrounding application graph to share.
export const AcpRpcHandlersLive = AcpRpcHandlersLayer.pipe(
  Layer.provide(Layer.mergeAll(AppLive, IdClockLive)),
)
