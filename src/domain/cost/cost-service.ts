/** @Acp.Domain.Cost.Service — the cost ledger and its derived rollups */
import { Chunk, Context, Effect, Layer, Option, Schema } from 'effect'
import { Storage } from '../../infrastructure/storage/storage.js'
import { EventStore } from '../events/index.js'
import {
  BudgetExhaustedError,
  StorageError,
  UnpricedModelError,
} from '../../protocol/errors/protocol-error.js'
import type { NotFoundError } from '../../protocol/errors/protocol-error.js'
import { CostEntry, Event, PriceTable } from '../../protocol/schema/index.js'
import type {
  Budget,
  CostEntryId,
  CostRollup,
  CostSource,
  ResourceUsage,
  Timestamp,
  WorkId,
  WorkerId,
  WorkspaceId,
} from '../../protocol/schema/index.js'
import { priceOf } from './price-table.js'
import { applyDescendant, applyOwn, rebuildOwn } from './cost-rollup.js'
import { decide } from './budget-decision.js'
import type { BudgetOnPath } from './budget-decision.js'
import { ENTRIES, PRICES, makeCostStore } from './cost-store.js'

export type CostServiceError = NotFoundError | UnpricedModelError | StorageError

export interface ReportCostInput {
  readonly entry_id: CostEntryId
  readonly work_id: WorkId
  readonly worker_id: Option.Option<WorkerId>
  readonly usage: ResourceUsage
  readonly source: CostSource
  readonly now: Timestamp
}

export interface CostServiceApi {
  readonly report: (
    input: ReportCostInput,
  ) => Effect.Effect<CostEntry, CostServiceError>
  readonly rollupOf: (
    workId: WorkId,
  ) => Effect.Effect<CostRollup, CostServiceError>
  readonly rebuild: (
    workId: WorkId,
  ) => Effect.Effect<CostRollup, CostServiceError>
  readonly setBudget: (
    workId: WorkId,
    budget: Budget,
  ) => Effect.Effect<CostRollup, CostServiceError>
  readonly setPriceTable: (
    table: PriceTable,
  ) => Effect.Effect<PriceTable, CostServiceError>
  readonly budgetPath: (
    workId: WorkId,
  ) => Effect.Effect<readonly BudgetOnPath[], NotFoundError | StorageError>
  /**
   * Admission at an entry boundary. `actor` names who is entering, so the
   * `budget.exhausted` event records who was refused rather than only what.
   */
  readonly checkAdmission: (
    workId: WorkId,
    actor: WorkerId,
    now: Timestamp,
  ) => Effect.Effect<void, NotFoundError | StorageError | BudgetExhaustedError>
}

export class CostService extends Context.Tag('CostService')<
  CostService,
  CostServiceApi
>() {}

const mapCodecError = (op: string) => (error: unknown) =>
  new StorageError({ op, cause: String(error) })

const make = Effect.gen(function* () {
  const storage = yield* Storage
  const events = yield* EventStore
  const store = makeCostStore(storage)

  const encodeEntry = (entry: CostEntry) =>
    Schema.encode(CostEntry)(entry).pipe(
      Effect.mapError(mapCodecError('encode_cost_entry')),
    )

  const decodeEntry = (value: unknown) =>
    Schema.decodeUnknown(CostEntry)(value).pipe(
      Effect.mapError(mapCodecError('decode_cost_entry')),
    )

  const readPriceTable = (
    workspaceId: WorkspaceId,
    now: Timestamp,
  ): Effect.Effect<PriceTable, StorageError> =>
    Effect.flatMap(storage.get(PRICES, workspaceId), (stored) =>
      Option.match(stored, {
        // No table configured prices compute at zero and leaves every model
        // unpriced — so a workspace must set prices before a budget can bind,
        // rather than silently metering everything as free.
        onNone: () =>
          Effect.succeed<PriceTable>({
            workspace_id: workspaceId,
            models: {},
            cpu_micro_usd_per_second: 0,
            mib_micro_usd_per_second: 0,
            updated_at: now,
          }),
        onSome: (value) =>
          Schema.decodeUnknown(PriceTable)(value).pipe(
            Effect.mapError(mapCodecError('decode_price_table')),
          ),
      }),
    )

  const budgetPath: CostServiceApi['budgetPath'] = (workId) =>
    Effect.map(store.ancestorPath(workId), (path) =>
      path.flatMap((unit) => [unit]),
    ).pipe(
      Effect.flatMap((path) =>
        Effect.forEach(path, (unit) =>
          Effect.map(store.readRollup(unit.id, unit.workspace_id), (rollup) =>
            Option.match(rollup.budget, {
              onNone: () => [] as readonly BudgetOnPath[],
              onSome: (budget) => [
                {
                  work_id: unit.id,
                  limit_micro_usd: budget.limit_micro_usd,
                  inclusive_micro_usd: rollup.inclusive_micro_usd,
                },
              ],
            }),
          ),
        ),
      ),
      Effect.map((nested) => nested.flat()),
    )

  const appendBudgetEvent = (
    type: 'budget.granted' | 'budget.exhausted',
    workspaceId: WorkspaceId,
    workId: WorkId,
    actor: WorkerId,
    now: Timestamp,
    data: Record<string, unknown>,
  ) =>
    Effect.flatMap(
      Schema.decodeUnknown(Event)({
        id: `event_${workId}_${type}_${now}`,
        type,
        workspace_id: workspaceId,
        work_id: workId,
        actor,
        timestamp: now,
        seq: 0,
        data,
      }).pipe(Effect.mapError(mapCodecError('decode_budget_event'))),
      (event) =>
        events.append({
          id: event.id,
          type: event.type,
          workspace_id: event.workspace_id,
          work_id: event.work_id,
          actor: event.actor,
          timestamp: event.timestamp,
          data: event.data,
        }),
    )

  const report: CostServiceApi['report'] = (input) =>
    Effect.gen(function* () {
      const path = yield* store.ancestorPath(input.work_id)
      const unit = path[0]
      const entry: CostEntry = {
        entry_id: input.entry_id,
        workspace_id: unit.workspace_id,
        work_id: input.work_id,
        worker_id: input.worker_id,
        usage: input.usage,
        source: input.source,
        recorded_at: input.now,
      }

      // Idempotency, and it must short-circuit before any rollup write: a
      // retrying engine that charged twice would corrupt every ancestor budget
      // above it, invisibly, because the ledger stays internally consistent.
      const created = yield* storage.putIfAbsent(
        ENTRIES,
        input.entry_id,
        yield* encodeEntry(entry),
      )
      if (!created) {
        const stored = yield* storage.get(ENTRIES, input.entry_id)
        return yield* Option.match(stored, {
          onNone: () => Effect.succeed(entry),
          onSome: decodeEntry,
        })
      }

      const table = yield* readPriceTable(unit.workspace_id, input.now)
      const price = priceOf(input.usage, table)
      let deltaMicroUsd = 0
      if (price._tag === 'Priced') {
        deltaMicroUsd = price.micro_usd
      } else {
        const budgets = yield* budgetPath(input.work_id)
        if (budgets.length > 0) {
          return yield* Effect.fail(
            new UnpricedModelError({
              workId: input.work_id,
              model: price.model,
            }),
          )
        }
      }

      if (deltaMicroUsd > 0) {
        // Own spend on the unit, subtree spend on every strict ancestor. The
        // entry is already durable, so a crash mid-propagation under-counts
        // rather than over-counts, and `rebuild` repairs it.
        yield* store.casRollup(unit.id, unit.workspace_id, (current) =>
          applyOwn(current, deltaMicroUsd),
        )
        yield* Effect.forEach(path.slice(1), (ancestor) =>
          store.casRollup(ancestor.id, ancestor.workspace_id, (current) =>
            applyDescendant(current, deltaMicroUsd),
          ),
        )
      }

      return entry
    })

  const rollupOf: CostServiceApi['rollupOf'] = (workId) =>
    Effect.flatMap(store.loadWork(workId), (unit) =>
      store.readRollup(unit.id, unit.workspace_id),
    )

  const rebuild: CostServiceApi['rebuild'] = (workId) =>
    Effect.gen(function* () {
      const unit = yield* store.loadWork(workId)
      const table = yield* readPriceTable(unit.workspace_id, unit.updated_at)
      const stored = yield* storage.queryBy(ENTRIES, [
        { field: 'work_id', value: workId },
      ])
      const entries = yield* Effect.forEach(
        Chunk.toReadonlyArray(stored),
        decodeEntry,
      )
      const prices = entries.map((entry) => {
        const price = priceOf(entry.usage, table)
        return price._tag === 'Priced' ? price.micro_usd : 0
      })
      return yield* store.casRollup(unit.id, unit.workspace_id, (current) =>
        rebuildOwn(current, prices),
      )
    })

  const setBudget: CostServiceApi['setBudget'] = (workId, budget) =>
    Effect.gen(function* () {
      const unit = yield* store.loadWork(workId)
      const next = yield* store.casRollup(
        unit.id,
        unit.workspace_id,
        (current) => ({ ...current, budget: Option.some(budget) }),
      )
      yield* appendBudgetEvent(
        'budget.granted',
        unit.workspace_id,
        unit.id,
        budget.set_by,
        budget.set_at,
        { work_id: unit.id, limit_micro_usd: budget.limit_micro_usd },
      )
      return next
    })

  const setPriceTable: CostServiceApi['setPriceTable'] = (table) =>
    Effect.gen(function* () {
      const encoded = yield* Schema.encode(PriceTable)(table).pipe(
        Effect.mapError(mapCodecError('encode_price_table')),
      )
      yield* storage.put(PRICES, table.workspace_id, encoded)
      return table
    })

  const checkAdmission: CostServiceApi['checkAdmission'] = (
    workId,
    actor,
    now,
  ) =>
    Effect.gen(function* () {
      const budgets = yield* budgetPath(workId)
      const decision = decide(budgets)
      if (decision._tag === 'Admit') return
      const unit = yield* store.loadWork(workId)
      // Appended before the failure, so the record explains the refusal even
      // though the call errored.
      yield* appendBudgetEvent(
        'budget.exhausted',
        unit.workspace_id,
        workId,
        actor,
        now,
        {
          work_id: workId,
          budget_work_id: decision.work_id,
          limit_micro_usd: decision.limit_micro_usd,
          inclusive_micro_usd: decision.inclusive_micro_usd,
        },
      )
      return yield* Effect.fail(
        new BudgetExhaustedError({
          workId,
          budgetWorkId: decision.work_id,
          limitMicroUsd: decision.limit_micro_usd,
          inclusiveMicroUsd: decision.inclusive_micro_usd,
        }),
      )
    })

  return {
    report,
    rollupOf,
    rebuild,
    setBudget,
    setPriceTable,
    budgetPath,
    checkAdmission,
  } satisfies CostServiceApi
})

export const CostServiceLive: Layer.Layer<
  CostService,
  never,
  Storage | EventStore
> = Layer.effect(CostService, make)
