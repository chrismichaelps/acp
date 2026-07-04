/** @Acp.App.Server.NativeRpcRoute — real HTTP mount for the native Effect RPC surface */
import { HttpLayerRouter } from '@effect/platform'
import { RpcSerialization, RpcServer } from '@effect/rpc'
import { Layer } from 'effect'
import {
  acpNativeRpcPath,
  AcpRpcGroup,
  AcpRpcHandlersLayer,
} from '../../infrastructure/rpc/index.js'
import { acpRouter } from './router.js'

export const nativeRpcPath = acpNativeRpcPath

const legacyV1Routes = HttpLayerRouter.add('*', '/v1/*', acpRouter)
const legacyJsonRpcRoute = HttpLayerRouter.add('*', '/rpc', acpRouter)
const livenessRoute = HttpLayerRouter.add('GET', '/health', acpRouter)
const readinessRoute = HttpLayerRouter.add('GET', '/ready', acpRouter)

export const AcpNativeRpcRouteLive = RpcServer.layerHttpRouter({
  group: AcpRpcGroup,
  path: nativeRpcPath,
  protocol: 'http',
}).pipe(
  Layer.provide(RpcSerialization.layerNdjson),
  Layer.provide(AcpRpcHandlersLayer),
)

export const AcpHttpRoutesLive = Layer.mergeAll(
  livenessRoute,
  readinessRoute,
  legacyV1Routes,
  legacyJsonRpcRoute,
  AcpNativeRpcRouteLive,
)
