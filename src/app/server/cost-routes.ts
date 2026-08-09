/** @Acp.App.Server.CostRoutes — ledger, budget and pricing handlers */
import { HttpServerRequest } from '@effect/platform'
import { Effect, Option } from 'effect'
import { CostService } from '../../domain/cost/index.js'
import { WorkerIdentityService } from '../../domain/identity/index.js'
import {
  ReportCostPayload,
  SetBudgetPayload,
} from '../../infrastructure/http/index.js'
import {
  CostEntry,
  CostRollup,
  PriceTable,
} from '../../protocol/schema/index.js'
import type { WorkId, WorkspaceId } from '../../protocol/schema/index.js'
import { ValidationError } from '../../protocol/errors/protocol-error.js'
import { IdClock } from './identity.js'
import * as target from './resource-workspace-auth.js'
import {
  authorizeWorkspace,
  ok,
  pathParam,
  respond,
  workerAssertion,
} from './route-support.js'

const workIdParam = () =>
  Effect.map(pathParam('work_id'), (value) => value as WorkId)

const workspaceIdParam = () =>
  Effect.map(pathParam('workspace_id'), (value) => value as WorkspaceId)

export const reportCost = respond('POST /v1/work/:work_id/cost')(
  Effect.gen(function* () {
    const cost = yield* CostService
    const identity = yield* WorkerIdentityService
    const idClock = yield* IdClock
    const workId = yield* workIdParam()
    const payload = yield* HttpServerRequest.schemaBodyJson(ReportCostPayload)
    const { actor } = yield* target.work('work:update', workId)
    const now = yield* idClock.now
    const assertion = yield* workerAssertion
    yield* identity.verify({
      workerId: actor,
      action: 'cost.report',
      targetId: workId,
      assertion: Option.map(assertion, (given) => ({
        workerId: given.worker_id,
        action: given.action,
        targetId: given.target_id,
        timestamp: given.timestamp,
        signature: given.signature,
      })),
      now,
      required: true,
    })
    const entry = yield* cost.report({
      entry_id: payload.entry_id,
      work_id: workId,
      worker_id: Option.some(actor),
      usage: payload.usage,
      source: 'attested',
      now,
    })
    return yield* ok(201)(CostEntry, entry)
  }),
)

export const getCost = respond('GET /v1/work/:work_id/cost')(
  Effect.gen(function* () {
    const cost = yield* CostService
    const workId = yield* workIdParam()
    yield* target.work('workspace:read', workId)
    return yield* ok(200)(CostRollup, yield* cost.rollupOf(workId))
  }),
)

export const setBudget = respond('PUT /v1/work/:work_id/budget')(
  Effect.gen(function* () {
    const cost = yield* CostService
    const idClock = yield* IdClock
    const workId = yield* workIdParam()
    const payload = yield* HttpServerRequest.schemaBodyJson(SetBudgetPayload)
    const { actor } = yield* target.work('work:update', workId)
    const now = yield* idClock.now
    const rollup = yield* cost.setBudget(workId, {
      limit_micro_usd: payload.limit_micro_usd,
      set_by: actor,
      set_at: now,
    })
    return yield* ok(200)(CostRollup, rollup)
  }),
)

export const setPrices = respond('PUT /v1/workspaces/:workspace_id/prices')(
  Effect.gen(function* () {
    const cost = yield* CostService
    const workspaceId = yield* workspaceIdParam()
    const table = yield* HttpServerRequest.schemaBodyJson(PriceTable)
    yield* authorizeWorkspace('workspace:write', workspaceId)
    if (table.workspace_id !== workspaceId) {
      return yield* Effect.fail(
        new ValidationError({
          issues: ['price table workspace_id must match the request path'],
        }),
      )
    }
    return yield* ok(200)(PriceTable, yield* cost.setPriceTable(table))
  }),
)
