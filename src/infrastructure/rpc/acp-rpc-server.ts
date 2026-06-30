/** @Acp.Infra.Rpc.Server — dependency-complete native RPC handler runtime */
import { Layer } from 'effect'
import { AppLive } from '../../app/index.js'
import { IdClockLive } from '../../app/server/identity.js'
import { AcpRpcSessionWorkerWorkspaceHandlersLive } from './acp-rpc-handlers.js'

// The full native RPC handler set with its domain dependencies satisfied:
// AppLive supplies the storage-backed services (sessions, work, leases,
// artifacts, checkpoints, reviews, memory, events) and IdClockLive supplies
// id/timestamp minting. This is the single server-side layer every transport
// (the `RpcTest` round-trip today, an `RpcServer.layer` HTTP/socket protocol
// next) mounts over — handlers never see the transport, honoring the
// [[Transport]] "domain never sees HTTP" invariant.
export const AcpRpcHandlersLive = AcpRpcSessionWorkerWorkspaceHandlersLive.pipe(
  Layer.provide(Layer.mergeAll(AppLive, IdClockLive)),
)
