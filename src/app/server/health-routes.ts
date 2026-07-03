/** @Acp.App.Server.HealthRoutes — unauthenticated liveness & readiness probes */
import { HttpServerResponse } from '@effect/platform'
import { Effect, Either } from 'effect'
import { Storage } from '../../infrastructure/storage/index.js'
import { ACP_PROTOCOL_VERSION } from '../../protocol/schema/index.js'
import { respond } from './route-support.js'

// Platform health checks (Railway / Fly / Render / k8s) are unauthenticated, so
// these probes never call `authorize` — they must answer before any session
// exists and without a bearer token.

/**
 * Liveness: the process is up and serving. Always 200 while the event loop
 * runs; it makes no backend calls, so a passing `/health` with a failing
 * `/ready` distinguishes "process alive" from "dependencies reachable".
 */
export const livenessProbe = respond('GET /health')(
  Effect.succeed(
    HttpServerResponse.unsafeJson(
      { status: 'ok', name: 'acp', protocol_version: ACP_PROTOCOL_VERSION },
      { status: 200 },
    ),
  ),
)

/**
 * Readiness: the storage backend answers. Runs one cheap `get` against a
 * sentinel key — success (even `Option.none`) proves the read path works; a
 * `StorageError` means the backend is unreachable, answered as `503` so load
 * balancers drain the replica instead of routing traffic to it.
 */
export const readinessProbe = respond('GET /ready')(
  Effect.gen(function* () {
    const storage = yield* Storage
    const probe = yield* Effect.either(storage.get('__health__', '__probe__'))
    return Either.isLeft(probe)
      ? HttpServerResponse.unsafeJson(
          { status: 'unavailable' },
          { status: 503 },
        )
      : HttpServerResponse.unsafeJson({ status: 'ready' }, { status: 200 })
  }),
)
