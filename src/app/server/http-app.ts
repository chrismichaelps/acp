/** @Acp.App.Server.HttpApp — the running ACP host layer (routes + sweeper over the app) */
import { HttpLayerRouter } from '@effect/platform'
import type { HttpServer as HttpServerType } from '@effect/platform'
import { Layer } from 'effect'
import type { StorageError } from '../../protocol/errors/protocol-error.js'
import { AppLive } from '../index.js'
import { IdClockLive } from './identity.js'
import { AcpHttpRoutesLive } from './native-rpc-route.js'
import { SweeperLive } from './sweeper.js'

/**
 * The running ACP host as one socket-agnostic layer: REST, legacy JSON-RPC, and
 * native Effect RPC routes served over the full in-memory application
 * ({@link AppLive}) and id/clock minting ({@link IdClockLive}), plus the
 * background {@link SweeperLive} TTL daemon. Both are provided one memoized
 * `AppLive ⊕ IdClockLive`, so every transport and the sweeper share the same
 * `Storage` instance. The residual requirement is the listening socket
 * (`HttpServer.HttpServer`), supplied by whoever launches it — `main.ts` binds a
 * production `NodeHttpServer` on `ACP_PORT`; live tests bind an ephemeral port.
 * Keeping this import-safe (no `Layer.launch`) lets tests reuse the exact
 * composition without running a server on import.
 */
export const HttpAppLive: Layer.Layer<
  never,
  StorageError,
  HttpServerType.HttpServer
> = Layer.mergeAll(HttpLayerRouter.serve(AcpHttpRoutesLive), SweeperLive).pipe(
  Layer.provide(Layer.mergeAll(AppLive, IdClockLive)),
)
