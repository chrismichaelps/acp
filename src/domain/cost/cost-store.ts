/** @Acp.Domain.Cost.Store — ancestor walk and the CAS-guarded rollup row */
import { Effect, Option, Schema } from 'effect'
import type { StorageApi } from '../../infrastructure/storage/storage.js'
import {
  NotFoundError,
  StorageError,
} from '../../protocol/errors/protocol-error.js'
import { CostRollup, WorkUnit } from '../../protocol/schema/index.js'
import type { WorkId, WorkspaceId } from '../../protocol/schema/index.js'
import { emptyRollup } from './cost-rollup.js'

/** The work-unit collection, read directly rather than through its service. */
export const WORK = 'work'
export const ENTRIES = 'cost_entries'
export const ROLLUPS = 'cost_rollups'
export const PRICES = 'price_tables'

/**
 * A CAS loop must be bounded. An unbounded retry under contention is a hang
 * that reports itself as a slow request; failing loudly is the honest outcome.
 * If this cap is ever reached in practice, the fix is per-ancestor sharded
 * counters, not a bigger number here.
 */
export const MAX_CAS_ATTEMPTS = 16

/** Guards against a cycle introduced by a bug turning the walk into a hang. */
const MAX_ANCESTOR_DEPTH = 1000

const decodeWork = (value: unknown) =>
  Schema.decodeUnknown(WorkUnit)(value).pipe(
    Effect.mapError(
      (error) =>
        new StorageError({ op: 'decode_work_unit', cause: String(error) }),
    ),
  )

const decodeRollup = (value: unknown) =>
  Schema.decodeUnknown(CostRollup)(value).pipe(
    Effect.mapError(
      (error) =>
        new StorageError({ op: 'decode_cost_rollup', cause: String(error) }),
    ),
  )

const encodeRollup = (rollup: CostRollup) =>
  Schema.encode(CostRollup)(rollup).pipe(
    Effect.mapError(
      (error) =>
        new StorageError({ op: 'encode_cost_rollup', cause: String(error) }),
    ),
  )

export const makeCostStore = (storage: StorageApi) => {
  const loadWork = (
    workId: WorkId,
  ): Effect.Effect<WorkUnit, NotFoundError | StorageError> =>
    Effect.gen(function* () {
      const stored = yield* storage.get(WORK, workId)
      if (Option.isNone(stored)) {
        return yield* Effect.fail(
          new NotFoundError({ entity: 'work', id: workId }),
        )
      }
      return yield* decodeWork(stored.value)
    })

  /**
   * The unit itself first, then each ancestor outward to the root. Order is the
   * contract: `decide` reports the nearest exhausted budget, and enforcement
   * charges own spend to the head and descendant spend to the tail.
   */
  const ancestorPath = (
    workId: WorkId,
  ): Effect.Effect<readonly WorkUnit[], NotFoundError | StorageError> =>
    Effect.gen(function* () {
      const path: WorkUnit[] = []
      let current = yield* loadWork(workId)
      path.push(current)
      while (Option.isSome(current.parent_id)) {
        if (path.length >= MAX_ANCESTOR_DEPTH) {
          return yield* Effect.fail(
            new StorageError({
              op: 'cost.ancestor_path',
              cause: `spawn graph exceeded ${String(MAX_ANCESTOR_DEPTH)} levels above ${workId}`,
            }),
          )
        }
        current = yield* loadWork(current.parent_id.value)
        path.push(current)
      }
      return path
    })

  const readRollup = (
    workId: WorkId,
    workspaceId: WorkspaceId,
  ): Effect.Effect<CostRollup, StorageError> =>
    Effect.flatMap(storage.get(ROLLUPS, workId), (stored) =>
      Option.match(stored, {
        onNone: () => Effect.succeed(emptyRollup(workId, workspaceId)),
        onSome: decodeRollup,
      }),
    )

  /**
   * Read-modify-write the rollup under the row's version counter. An absent row
   * is created with `putIfAbsent`, so two concurrent first writes cannot both
   * believe they started from zero.
   */
  const casRollup = (
    workId: WorkId,
    workspaceId: WorkspaceId,
    update: (current: CostRollup) => CostRollup,
  ): Effect.Effect<CostRollup, StorageError> =>
    Effect.gen(function* () {
      for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
        const stored = yield* storage.getVersioned(ROLLUPS, workId)
        if (Option.isNone(stored)) {
          const next = update(emptyRollup(workId, workspaceId))
          const encoded = yield* encodeRollup(next)
          const created = yield* storage.putIfAbsent(ROLLUPS, workId, encoded)
          if (created) return next
          continue
        }
        const current = yield* decodeRollup(stored.value.value)
        const next = update(current)
        const encoded = yield* encodeRollup(next)
        const swapped = yield* storage.replaceIfVersion(
          ROLLUPS,
          workId,
          stored.value.version,
          encoded,
        )
        if (swapped) return next
      }
      return yield* Effect.fail(
        new StorageError({
          op: 'cost.rollup.cas',
          cause: `contention on ${workId} exceeded ${String(MAX_CAS_ATTEMPTS)} attempts`,
        }),
      )
    })

  return { loadWork, ancestorPath, readRollup, casRollup }
}

export type CostStore = ReturnType<typeof makeCostStore>
