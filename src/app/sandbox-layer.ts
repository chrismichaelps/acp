/** @Acp.App.SandboxLayer — selects the sandbox adapter from configuration */
import { Effect, Either, Layer, Option } from 'effect'
import { AppConfigTag } from '../config/app-config.js'
import { noSandboxProvider, SandboxProvider } from '../domain/sandbox/index.js'
import {
  assertRuntimeAvailable,
  makeDockerSandboxProvider,
} from '../infrastructure/sandbox/index.js'
import { dockerEngineOverSocket } from '../infrastructure/sandbox/docker-engine.js'

/**
 * Chooses the sandbox adapter named by `ACP_SANDBOX_ADAPTER`.
 *
 * `none` is the default and provisions nothing, so a host that has not opted in
 * behaves exactly as one built before the runtime existed. Selecting `docker`
 * without an image is a startup failure rather than a silent fallback: quietly
 * degrading to no isolation is the one outcome an operator who asked for a
 * sandbox must never get. See [[ADR-0026-agent-sandbox-runtime]].
 */
export const SandboxProviderLive: Layer.Layer<
  SandboxProvider,
  never,
  AppConfigTag
> = Layer.effect(
  SandboxProvider,
  Effect.gen(function* () {
    const config = yield* AppConfigTag
    if (config.sandboxAdapter === 'none') return noSandboxProvider
    const image = yield* Option.match(config.sandboxImage, {
      onNone: () =>
        Effect.dieMessage(
          'ACP_SANDBOX_ADAPTER=docker requires ACP_SANDBOX_IMAGE',
        ),
      onSome: Effect.succeed,
    })
    const engine = dockerEngineOverSocket()

    // Isolation strength must never be silently weaker than requested, so a
    // runtime the daemon does not offer fails startup rather than surfacing
    // later as a container-create error.
    const available = yield* engine
      .listRuntimes()
      .pipe(
        Effect.orDieWith(
          (cause) =>
            new Error(`cannot reach the Docker daemon: ${cause.message}`),
        ),
      )
    const preflight = assertRuntimeAvailable(config.sandboxRuntime, available)
    if (Either.isLeft(preflight)) {
      return yield* Effect.dieMessage(preflight.left)
    }

    return makeDockerSandboxProvider(engine, {
      image,
      ...Option.match(config.sandboxRuntime, {
        onNone: () => ({}),
        onSome: (runtime) => ({ runtime }),
      }),
    })
  }),
)
