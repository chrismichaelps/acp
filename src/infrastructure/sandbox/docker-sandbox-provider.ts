/** @Acp.Infra.Sandbox.DockerProvider — SandboxProvider over the Docker Engine API */
import { Effect, Layer } from 'effect'
import { SandboxProvider } from '../../domain/sandbox/index.js'
import type {
  SandboxHandle,
  SandboxProviderApi,
} from '../../domain/sandbox/index.js'
import { StorageError } from '../../protocol/errors/protocol-error.js'
import type { WorkId } from '../../protocol/schema/index.js'
import {
  containerNameFor,
  toCreateContainerRequest,
  toSandboxStatus,
} from './docker-request.js'

/**
 * The narrow slice of the Docker Engine API this adapter needs, injected so the
 * provider's behaviour is testable without a daemon. Implementations speak HTTP
 * over the unix socket.
 */
export interface DockerEngineApi {
  readonly createContainer: (
    name: string,
    body: unknown,
  ) => Effect.Effect<string, Error>
  readonly startContainer: (id: string) => Effect.Effect<void, Error>
  readonly inspectContainer: (name: string) => Effect.Effect<
    | {
        readonly Id: string
        readonly State: { Status: string; ExitCode: number }
      }
    | undefined,
    Error
  >
  readonly removeContainer: (name: string) => Effect.Effect<void, Error>
}

const asStorageError = (op: string) => (cause: Error) =>
  new StorageError({ op, cause: cause.message })

export interface DockerSandboxOptions {
  /** Image the agent runs in. Operator-chosen; ACP never builds it. */
  readonly image: string
}

export const makeDockerSandboxProvider = (
  engine: DockerEngineApi,
  options: DockerSandboxOptions,
): SandboxProviderApi => {
  const inspect = (
    workId: WorkId,
  ): Effect.Effect<SandboxHandle, StorageError> =>
    engine.inspectContainer(containerNameFor(workId)).pipe(
      Effect.mapError(asStorageError('sandbox_inspect')),
      Effect.map((found) => {
        if (found === undefined) return { workId, status: 'absent' as const }
        const mapped = toSandboxStatus(found.State)
        return {
          workId,
          status: mapped.status,
          externalId: found.Id,
          ...(mapped.exitCode === undefined
            ? {}
            : { exitCode: mapped.exitCode }),
        }
      }),
    )

  return {
    start: (spec) =>
      Effect.gen(function* () {
        const name = containerNameFor(spec.workId)
        // A sandbox is addressed by work unit, so a restart re-creates rather
        // than duplicating. Removing first keeps `start` idempotent.
        yield* engine.removeContainer(name).pipe(Effect.ignore)
        const id = yield* engine
          .createContainer(name, toCreateContainerRequest(spec, options.image))
          .pipe(Effect.mapError(asStorageError('sandbox_create')))
        yield* engine
          .startContainer(id)
          .pipe(Effect.mapError(asStorageError('sandbox_start')))
        return yield* inspect(spec.workId)
      }),

    inspect,

    stop: (workId) =>
      engine
        .removeContainer(containerNameFor(workId))
        .pipe(Effect.mapError(asStorageError('sandbox_stop'))),
  }
}

export const DockerSandboxLive = (
  engine: DockerEngineApi,
  options: DockerSandboxOptions,
): Layer.Layer<SandboxProvider> =>
  Layer.succeed(SandboxProvider, makeDockerSandboxProvider(engine, options))
