/** @Acp.Domain.Cost.Service.Test — entries, rollups and budget admission */
import { describe, expect, it } from 'vitest'
import { Effect, Option, Schema } from 'effect'
import { Storage } from '../../infrastructure/storage/index.js'
import { CostEntryId } from '../../protocol/schema/index.js'
import { WorkUnitService } from '../work-units/index.js'
import { CostService } from './cost-service.js'
import {
  CostTestLayer,
  costNow,
  costWorkerId,
  makeHarness,
} from './cost-test-support.js'
import { zeroUsage } from './resource-usage.js'

const entryId = (raw: string) => Schema.decodeUnknownSync(CostEntryId)(raw)

const run = <A, E>(
  program: Effect.Effect<A, E, CostService | WorkUnitService | Storage>,
) =>
  Effect.runPromise(Effect.provide(program, CostTestLayer))

describe('CostService.report', () => {
  it('prices own spend and propagates descendant spend to every ancestor', () =>
    run(
      Effect.gen(function* () {
        const h = yield* makeHarness
        const cost = yield* CostService
        yield* cost.report({
          entry_id: entryId('cost_deep'),
          work_id: h.grandchildId,
          worker_id: Option.none(),
          usage: { ...zeroUsage, cpu_seconds: 5 },
          source: 'metered',
          now: costNow,
        })
        expect((yield* cost.rollupOf(h.grandchildId)).own_micro_usd).toBe(50)
        expect((yield* cost.rollupOf(h.childId)).own_micro_usd).toBe(0)
        expect((yield* cost.rollupOf(h.childId)).inclusive_micro_usd).toBe(50)
        expect((yield* cost.rollupOf(h.rootId)).inclusive_micro_usd).toBe(50)
      }),
    ))

  it('does not charge a replayed entry twice', () =>
    run(
      Effect.gen(function* () {
        const h = yield* makeHarness
        const cost = yield* CostService
        const input = {
          entry_id: entryId('cost_dup'),
          work_id: h.rootId,
          worker_id: Option.none(),
          usage: { ...zeroUsage, cpu_seconds: 1 },
          source: 'metered' as const,
          now: costNow,
        }
        yield* cost.report(input)
        yield* cost.report(input)
        expect((yield* cost.rollupOf(h.rootId)).own_micro_usd).toBe(10)
      }),
    ))

  it('refuses an unpriced model only while a budget applies', () =>
    run(
      Effect.gen(function* () {
        const h = yield* makeHarness
        const cost = yield* CostService
        const unpriced = (id: string) =>
          cost.report({
            entry_id: entryId(id),
            work_id: h.rootId,
            worker_id: Option.none(),
            usage: {
              ...zeroUsage,
              model: Option.some('mystery'),
              input_tokens: 5,
            },
            source: 'attested',
            now: costNow,
          })
        expect((yield* Effect.either(unpriced('cost_free')))._tag).toBe('Right')
        yield* h.setBudget(h.rootId, 1_000)
        expect((yield* Effect.either(unpriced('cost_unpriced')))._tag).toBe(
          'Left',
        )
      }),
    ))

  it('rebuilds own spend from ledger entries', () =>
    run(
      Effect.gen(function* () {
        const h = yield* makeHarness
        const cost = yield* CostService
        yield* cost.report({
          entry_id: entryId('cost_rebuild'),
          work_id: h.rootId,
          worker_id: Option.none(),
          usage: { ...zeroUsage, cpu_seconds: 2 },
          source: 'metered',
          now: costNow,
        })
        expect((yield* cost.rebuild(h.rootId)).own_micro_usd).toBe(20)
      }),
    ))
})

describe('CostService.checkAdmission', () => {
  it('admits an unbudgeted path', () =>
    run(
      Effect.gen(function* () {
        const h = yield* makeHarness
        const cost = yield* CostService
        expect(
          (yield* Effect.either(
            cost.checkAdmission(h.childId, costWorkerId, costNow),
          ))._tag,
        ).toBe('Right')
      }),
    ))

  it('refuses on an exhausted ancestor and records both budget events', () =>
    run(
      Effect.gen(function* () {
        const h = yield* makeHarness
        const cost = yield* CostService
        yield* h.setBudget(h.rootId, 100)
        yield* cost.report({
          entry_id: entryId('cost_over'),
          work_id: h.grandchildId,
          worker_id: Option.none(),
          usage: { ...zeroUsage, cpu_seconds: 20 },
          source: 'metered',
          now: costNow,
        })
        expect(
          (yield* Effect.either(
            cost.checkAdmission(h.childId, costWorkerId, costNow),
          ))._tag,
        ).toBe('Left')
        const types = (yield* h.readEvents()).map((event) => event.type)
        expect(types).toContain('budget.granted')
        expect(types).toContain('budget.exhausted')
      }),
    ))
})
