/** @Acp.Infra.Http.Api.Cost — ledger, budget and price-table contract */
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform'
import { Schema } from 'effect'
import {
  CostEntry,
  CostEntryId,
  CostRollup,
  PriceTable,
  ProtocolError,
  ResourceUsage,
  WorkId,
  WorkspaceId,
} from '../../protocol/schema/index.js'

const protocolError = (status: number) =>
  ({ status }) satisfies { readonly status: number }

export const CostWorkPath = Schema.Struct({
  work_id: HttpApiSchema.param('work_id', WorkId),
})

export const CostWorkspacePath = Schema.Struct({
  workspace_id: HttpApiSchema.param('workspace_id', WorkspaceId),
})

export const ReportCostPayload = Schema.Struct({
  entry_id: CostEntryId,
  usage: ResourceUsage,
})
export type ReportCostPayload = typeof ReportCostPayload.Type

export const SetBudgetPayload = Schema.Struct({
  limit_micro_usd: Schema.Number.pipe(Schema.nonNegative()),
})
export type SetBudgetPayload = typeof SetBudgetPayload.Type

export const CostGroup = HttpApiGroup.make('cost')
  .add(
    HttpApiEndpoint.post('reportCost', '/v1/work/:work_id/cost')
      .setPath(CostWorkPath)
      .setPayload(ReportCostPayload)
      .addSuccess(CostEntry, { status: 201 })
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(401))
      .addError(ProtocolError, protocolError(403))
      .addError(ProtocolError, protocolError(404)),
  )
  .add(
    HttpApiEndpoint.get('getCost', '/v1/work/:work_id/cost')
      .setPath(CostWorkPath)
      .addSuccess(CostRollup)
      .addError(ProtocolError, protocolError(401))
      .addError(ProtocolError, protocolError(404)),
  )
  .add(
    HttpApiEndpoint.put('setBudget', '/v1/work/:work_id/budget')
      .setPath(CostWorkPath)
      .setPayload(SetBudgetPayload)
      .addSuccess(CostRollup)
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(401))
      .addError(ProtocolError, protocolError(403))
      .addError(ProtocolError, protocolError(404)),
  )
  .add(
    HttpApiEndpoint.put('setPrices', '/v1/workspaces/:workspace_id/prices')
      .setPath(CostWorkspacePath)
      .setPayload(PriceTable)
      .addSuccess(PriceTable)
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(401))
      .addError(ProtocolError, protocolError(403)),
  )
