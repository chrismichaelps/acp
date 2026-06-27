/** @Acp.App.Server.HttpApp — the running ACP host layer (router + sweeper over the app) */
import { HttpServer } from '@effect/platform'
import { Layer } from 'effect'
import { AppLive } from '../index.js'
import { IdClockLive } from './identity.js'
import { acpRouter } from './router.js'
import { SweeperLive } from './sweeper.js'

/**
 * The running ACP host as one socket-agnostic layer: {@link acpRouter} served
 * over the full in-memory application ({@link AppLive}) and id/clock minting
 * ({@link IdClockLive}), plus the background {@link SweeperLive} TTL daemon. Both
 * are provided one memoized `AppLive ⊕ IdClockLive`, so the router and the
 * sweeper share the same `Storage` instance. The residual requirement is the
 * listening socket (`HttpServer.HttpServer`), supplied by whoever launches it —
 * `main.ts` binds a production `NodeHttpServer` on `ACP_PORT`; the live-boot smoke
 * test binds an ephemeral port. Keeping this import-safe (no `Layer.launch`) lets
 * tests reuse the exact composition without running a server on import.
 */
export const HttpAppLive: Layer.Layer<never, never, HttpServer.HttpServer> =
  Layer.mergeAll(HttpServer.serve(acpRouter), SweeperLive).pipe(
    Layer.provide(Layer.mergeAll(AppLive, IdClockLive)),
  )
