/** @Acp.App.Server.NativeRpcRoute — real HTTP mount for the native Effect RPC surface */
import { HttpLayerRouter } from '@effect/platform'
import { RpcSerialization, RpcServer } from '@effect/rpc'
import { Layer } from 'effect'
import {
  AcpRpcGroup,
  AcpRpcHandlersLayer,
} from '../../infrastructure/rpc/index.js'
import { acpRouter } from './router.js'

export const nativeRpcPath = '/rpc/native'

const legacyV1Routes = HttpLayerRouter.add('*', '/v1/*', acpRouter)
const legacyJsonRpcRoute = HttpLayerRouter.add('*', '/rpc', acpRouter)

export const AcpNativeRpcRouteLive = RpcServer.layerHttpRouter({
  group: AcpRpcGroup,
  path: nativeRpcPath,
  protocol: 'http',
}).pipe(
  Layer.provide(RpcSerialization.layerNdjson),
  Layer.provide(AcpRpcHandlersLayer),
)

export const AcpHttpRoutesLive = Layer.mergeAll(
  legacyV1Routes,
  legacyJsonRpcRoute,
  AcpNativeRpcRouteLive,
)
