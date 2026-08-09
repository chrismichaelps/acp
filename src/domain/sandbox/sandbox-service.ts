/** @Acp.Domain.Sandbox.Service — composes leases, mounts and the provider */
import { Context, Effect, Layer, Option, Ref, Schema } from 'effect'
import { AppConfigTag } from '../../config/app-config.js'
import { LeaseService } from '../leases/index.js'
import { WorkUnitService } from '../work-units/index.js'
import { CostService, zeroUsage } from '../cost/index.js'
import type { CostServiceError } from '../cost/index.js'
import {
  NotFoundError,
  ValidationError,
} from '../../protocol/errors/protocol-error.js'
import type {
  BudgetExhaustedError,
  StorageError,
} from '../../protocol/errors/protocol-error.js'
import { CostEntryId } from '../../protocol/schema/index.js'
import type { Timestamp, WorkId } from '../../protocol/schema/index.js'
import { computeMountPlan } from './mount-plan.js'
import { SandboxProvider } from './sandbox-provider.js'
import type { SandboxHandle } from './sandbox-provider.js'

export type SandboxServiceError =
  | NotFoundError
  | ValidationError
  | StorageError
  | CostServiceError
  | BudgetExhaustedError

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
  readonly stop: (
    workId: WorkId,
    now: Timestamp,
  ) => Effect.Effect<void, SandboxServiceError>
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
  const cost = yield* CostService
  const startedAt = yield* Ref.make(new Map<WorkId, Timestamp>())

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

      yield* cost.checkAdmission(workId, work.created_by, now)

      const workspaceLeases = yield* leases.list(work.workspace_id)
      const plan = computeMountPlan({
        workspaceRoot: root,
        workId,
        leases: workspaceLeases,
        now,
      })

      const handle = yield* provider.start({
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
      yield* Ref.update(startedAt, (starts) => {
        if (starts.has(workId)) return starts
        const next = new Map(starts)
        next.set(workId, now)
        return next
      })
      return handle
    })

  const stop: SandboxServiceApi['stop'] = (workId, now) =>
    Effect.gen(function* () {
      yield* provider.stop(workId)
      const started = yield* Ref.modify(startedAt, (starts) => {
        const value = starts.get(workId)
        if (value === undefined) return [Option.none<Timestamp>(), starts]
        const next = new Map(starts)
        next.delete(workId)
        return [Option.some(value), next]
      })
      if (Option.isNone(started)) return

      const elapsedSeconds = Math.max(
        0,
        (Date.parse(now) - Date.parse(started.value)) / 1_000,
      )
      yield* cost.report({
        entry_id: Schema.decodeUnknownSync(CostEntryId)(
          `cost_sandbox_${workId}_${started.value}`,
        ),
        work_id: workId,
        worker_id: Option.none(),
        usage: { ...zeroUsage, cpu_seconds: elapsedSeconds },
        source: 'metered',
        now,
      })
    })

  return {
    ensure,
    status: (workId) => provider.inspect(workId),
    stop,
  } satisfies SandboxServiceApi
})

export const SandboxServiceLive: Layer.Layer<
  SandboxService,
  never,
  AppConfigTag | SandboxProvider | WorkUnitService | LeaseService | CostService
> = Layer.effect(SandboxService, make)
