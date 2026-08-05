/** @Acp.Domain.Sandbox.Service — composes leases, mounts and the provider */
import { Context, Effect, Layer, Option } from 'effect'
import { AppConfigTag } from '../../config/app-config.js'
import { LeaseService } from '../leases/index.js'
import { WorkUnitService } from '../work-units/index.js'
import {
  NotFoundError,
  ValidationError,
} from '../../protocol/errors/protocol-error.js'
import type { StorageError } from '../../protocol/errors/protocol-error.js'
import type { Timestamp, WorkId } from '../../protocol/schema/index.js'
import { computeMountPlan } from './mount-plan.js'
import { SandboxProvider } from './sandbox-provider.js'
import type { SandboxHandle } from './sandbox-provider.js'

export type SandboxServiceError = NotFoundError | ValidationError | StorageError

export interface SandboxServiceApi {
  /**
   * Provisions (or re-provisions) the sandbox for a work unit from its current
   * leases. Idempotent, because the provider addresses a sandbox by work id.
   */
  readonly ensure: (
    workId: WorkId,
    now: Timestamp,
  ) => Effect.Effect<SandboxHandle, SandboxServiceError>
  readonly status: (
    workId: WorkId,
  ) => Effect.Effect<SandboxHandle, SandboxServiceError>
  readonly stop: (workId: WorkId) => Effect.Effect<void, SandboxServiceError>
}

export class SandboxService extends Context.Tag('SandboxService')<
  SandboxService,
  SandboxServiceApi
>() {}

const make = Effect.gen(function* () {
  const config = yield* AppConfigTag
  const provider = yield* SandboxProvider
  const workUnits = yield* WorkUnitService
  const leases = yield* LeaseService

  const requireWork = (workId: WorkId) =>
    Effect.flatMap(workUnits.get(workId), (found) =>
      Option.match(found, {
        onNone: () =>
          Effect.fail(new NotFoundError({ entity: 'work', id: workId })),
        onSome: Effect.succeed,
      }),
    )

  const ensure: SandboxServiceApi['ensure'] = (workId, now) =>
    Effect.gen(function* () {
      const work = yield* requireWork(workId)

      // Without a workspace root there is no boundary to contain leased paths
      // inside, so provisioning would be unsafe rather than merely unconfigured.
      const root = yield* Option.match(config.workspaceRoot, {
        onNone: () =>
          Effect.fail(
            new ValidationError({
              issues: [
                'ACP_WORKSPACE_ROOT must be set before a sandbox can be provisioned',
              ],
            }),
          ),
        onSome: Effect.succeed,
      })

      const workspaceLeases = yield* leases.list(work.workspace_id)
      const plan = computeMountPlan({
        workspaceRoot: root,
        workId,
        leases: workspaceLeases,
        now,
      })

      return yield* provider.start({
        workspaceId: work.workspace_id,
        workId,
        root: plan.root,
        writable: plan.writable,
        // Egress is denied until an allow-list exists; a sandbox that can reach
        // anything is not a boundary. Widening this is a later slice.
        networkAllow: [],
        // Populated by the host at start; never persisted anywhere.
        secrets: {},
      })
    })

  return {
    ensure,
    status: (workId) => provider.inspect(workId),
    stop: (workId) => provider.stop(workId),
  } satisfies SandboxServiceApi
})

export const SandboxServiceLive: Layer.Layer<
  SandboxService,
  never,
  AppConfigTag | SandboxProvider | WorkUnitService | LeaseService
> = Layer.effect(SandboxService, make)
