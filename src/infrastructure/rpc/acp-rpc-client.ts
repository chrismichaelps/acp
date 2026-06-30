/** @Acp.Infra.Rpc.Client — typed first-party native RPC client */
import { FetchHttpClient } from '@effect/platform'
import { RpcClient, RpcSerialization } from '@effect/rpc'
import { Layer } from 'effect'
import { AcpRpcGroup } from './acp-rpc-contract.js'

// Build the generated, fully-typed client for the native RPC surface. Tags are
// dotted (e.g. `session.initialize`), so the client is prefix-grouped:
// `client.session.initialize(payload, { headers })`,
// `client.workspace.create(payload, { headers })`, etc. Each method returns an
// Effect whose error channel is the contract's typed `ProtocolError`. Bearer
// auth is forwarded per call via the `headers` option (or `RpcClient.withHeaders`
// for a scoped default), matching how handlers read `options.headers`.
export const makeAcpRpcClient = RpcClient.make(AcpRpcGroup)

// NDJSON-framed streaming-HTTP transport for the client. Point `url` at the
// host's mounted native RPC route; serialization and the platform fetch client
// are supplied so callers only provide the URL.
export const acpRpcClientHttpLayer = (
  url: string,
): Layer.Layer<RpcClient.Protocol> =>
  RpcClient.layerProtocolHttp({ url }).pipe(
    Layer.provide(RpcSerialization.layerNdjson),
    Layer.provide(FetchHttpClient.layer),
  )
