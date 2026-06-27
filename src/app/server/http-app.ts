/** @Acp.App.Server.HttpApp — the ACP HTTP service layer (router over the full app) */
import { HttpServer } from '@effect/platform'
import { Layer } from 'effect'
import { AppLive } from '../index.js'
import { IdClockLive } from './identity.js'
import { acpRouter } from './router.js'

/**
 * The ACP HTTP service as one socket-agnostic layer: {@link acpRouter} served
 * over the full in-memory application ({@link AppLive}) and id/clock minting
 * ({@link IdClockLive}). The residual requirement is the listening socket
 * (`HttpServer.HttpServer`), supplied by whoever launches it — `main.ts` binds a
 * production `NodeHttpServer` on `ACP_PORT`; the live-boot smoke test binds an
 * ephemeral port. Keeping this import-safe (no `Layer.launch`) lets tests reuse
 * the exact composition without running a server on import.
 */
export const HttpAppLive: Layer.Layer<never, never, HttpServer.HttpServer> =
  HttpServer.serve(acpRouter).pipe(
    Layer.provide(Layer.mergeAll(AppLive, IdClockLive)),
  )
