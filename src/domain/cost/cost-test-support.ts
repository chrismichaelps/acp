/** @Acp.Domain.Cost.TestSupport — a workspace, a priced spawn chain, helpers */
import { Chunk, Effect, Layer, Schema } from 'effect'
import { TestAppConfigLive } from '../../config/app-config-test-support.js'
import {
  InMemoryStorageLive,
  Storage,
} from '../../infrastructure/storage/index.js'
import {
  CreateWorkPayload,
  Timestamp,
  WorkId,
  WorkerId,
  WorkspaceId,
} from '../../protocol/schema/index.js'
import type { CostRollup, Event } from '../../protocol/schema/index.js'
import { EventStoreLive, InProcessEventBrokerLive } from '../events/index.js'
import { NoHooksLive } from '../hooks/index.js'
import { TestIdentityLive } from '../identity/identity-test-support.js'
import { WorkUnitService, WorkUnitServiceLive } from '../work-units/index.js'
import { CostService, CostServiceLive } from './cost-service.js'

export const costNow = Schema.decodeUnknownSync(Timestamp)(
  '2026-08-08T10:00:00Z',
)
export const costWorkerId = Schema.decodeUnknownSync(WorkerId)('agent_cost')

const workspaceId = Schema.decodeUnknownSync(WorkspaceId)('workspace_cost')
const rootId = Schema.decodeUnknownSync(WorkId)('work_root')
const childId = Schema.decodeUnknownSync(WorkId)('work_child')
const grandchildId = Schema.decodeUnknownSync(WorkId)('work_grandchild')

const base = Layer.merge(
  Layer.provideMerge(
    EventStoreLive,
    Layer.merge(InMemoryStorageLive, InProcessEventBrokerLive),
  ),
  Layer.mergeAll(TestAppConfigLive(), NoHooksLive, TestIdentityLive),
)
const cost = Layer.provideMerge(CostServiceLive, base)
const work = Layer.provideMerge(WorkUnitServiceLive, Layer.merge(base, cost))

export const CostTestLayer = Layer.merge(work, cost)

export interface CostHarness {
  readonly workspaceId: WorkspaceId
  readonly rootId: WorkId
  readonly childId: WorkId
  readonly grandchildId: WorkId
  readonly setBudget: (
    workId: WorkId,
    limitMicroUsd: number,
  ) => Effect.Effect<CostRollup>
  readonly readEvents: () => Effect.Effect<readonly Event[]>
}

const create = (id: WorkId, parent?: WorkId) =>
  Effect.flatMap(WorkUnitService, (service) =>
    service.create({
      id,
      payload: Schema.decodeUnknownSync(CreateWorkPayload)({
        workspace_id: workspaceId,
        title: id,
        ...(parent === undefined ? {} : { parent_id: parent }),
      }),
      createdBy: costWorkerId,
      now: costNow,
    }),
  )

export const makeHarness: Effect.Effect<
  CostHarness,
  never,
  CostService | WorkUnitService | Storage
> = Effect.gen(function* () {
  const workUnits = yield* WorkUnitService
  const costs = yield* CostService
  const storage = yield* Storage

  yield* create(rootId)
  yield* workUnits.claim(rootId, costWorkerId, costNow)
  yield* workUnits.transition(rootId, 'running', costWorkerId, costNow)
  yield* create(childId, rootId)
  yield* workUnits.claim(childId, costWorkerId, costNow)
  yield* workUnits.transition(childId, 'running', costWorkerId, costNow)
  yield* create(grandchildId, childId)
  yield* costs.setPriceTable({
    workspace_id: workspaceId,
    models: {
      'claude-opus-5': {
        input_micro_usd_per_token: 15,
        output_micro_usd_per_token: 75,
        cached_input_micro_usd_per_token: 2,
      },
    },
    cpu_micro_usd_per_second: 10,
    mib_micro_usd_per_second: 1,
    updated_at: costNow,
  })

  return {
    workspaceId,
    rootId,
    childId,
    grandchildId,
    setBudget: (workId: WorkId, limitMicroUsd: number) =>
      costs
        .setBudget(workId, {
          limit_micro_usd: limitMicroUsd,
          set_by: costWorkerId,
          set_at: costNow,
        })
        .pipe(Effect.orDie),
    readEvents: () =>
      storage
        .readEventsTail(workspaceId, 100)
        .pipe(Effect.map(Chunk.toReadonlyArray), Effect.orDie),
  }
}).pipe(Effect.orDie)
