/** @Acp.Domain.Sandbox.Provider — the isolation seam */
import { Context, Effect, Layer } from 'effect'
import type { StorageError } from '../../protocol/errors/protocol-error.js'
import type { WorkId, WorkspaceId } from '../../protocol/schema/index.js'
import type { Mount } from './mount-plan.js'

/**
 * Lifecycle of a sandbox as ACP observes it. Deliberately not mapped onto
 * `WorkState`: an exit code cannot distinguish success from an OOM kill, and
 * domain state must not be decided by the scheduler — see
 * [[ADR-0026-agent-sandbox-runtime]].
 */
export type SandboxStatus = 'starting' | 'running' | 'exited' | 'absent'

export interface SandboxSpec {
  readonly workspaceId: WorkspaceId
  readonly workId: WorkId
  /** Read-only workspace mount. */
  readonly root: Mount
  /** Read-write mounts, one per leased path. */
  readonly writable: readonly Mount[]
  /** Hosts the sandbox may reach. Everything else is denied. */
  readonly networkAllow: readonly string[]
  /**
   * Injected at start and never persisted — not in the event log, an artifact,
   * or a checkpoint. Adapters must not echo these into logs.
   */
  readonly secrets: Readonly<Record<string, string>>
}

export interface SandboxHandle {
  readonly workId: WorkId
  readonly status: SandboxStatus
  /** Adapter-specific identifier, e.g. a container id. Absent when `none`. */
  readonly externalId?: string
  readonly exitCode?: number
}

/**
 * An isolated place to execute, with a defined filesystem and network surface.
 *
 * The port names the capability and leaves the mechanism to adapters, because
 * isolation technology is mid-shift: Docker moved this workload from containers
 * to microVMs inside one release cycle, and a design that hardcoded `docker run`
 * would have to be rewritten. Adapters anticipated: `none`, `docker`, and a
 * microVM-backed `docker-sandbox`.
 */
export interface SandboxProviderApi {
  readonly start: (
    spec: SandboxSpec,
  ) => Effect.Effect<SandboxHandle, StorageError>
  readonly inspect: (
    workId: WorkId,
  ) => Effect.Effect<SandboxHandle, StorageError>
  readonly stop: (workId: WorkId) => Effect.Effect<void, StorageError>
}

export class SandboxProvider extends Context.Tag('SandboxProvider')<
  SandboxProvider,
  SandboxProviderApi
>() {}

/**
 * The default: provisions nothing and reports every work unit as having no
 * sandbox. A host that has not opted in behaves exactly as one built before
 * this feature existed.
 */
export const NoSandboxLive: Layer.Layer<SandboxProvider> = Layer.succeed(
  SandboxProvider,
  {
    start: (spec) =>
      Effect.succeed({ workId: spec.workId, status: 'absent' as const }),
    inspect: (workId) => Effect.succeed({ workId, status: 'absent' as const }),
    stop: () => Effect.void,
  },
)
