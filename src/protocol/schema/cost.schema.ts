/** @Acp.Protocol.Cost — dimensioned spend, pricing policy, and budgets */
import { Schema } from 'effect'
import { CostEntryId, WorkId, WorkerId, WorkspaceId } from './ids.js'
import { Timestamp } from './common.js'

const NonNegative = Schema.Number.pipe(Schema.nonNegative())

/**
 * Raw dimensioned spend — never a converted figure. Storing quantities rather
 * than a priced scalar is what lets history be re-priced as a read-time view
 * instead of a migration. See [[cost-budget-accounting]].
 */
export const ResourceUsage = Schema.Struct({
  model: Schema.optionalWith(Schema.NonEmptyString, {
    as: 'Option',
    nullable: true,
  }),
  input_tokens: NonNegative,
  output_tokens: NonNegative,
  cached_input_tokens: NonNegative,
  cpu_seconds: NonNegative,
  mib_seconds: NonNegative,
})
export type ResourceUsage = typeof ResourceUsage.Type

/**
 * Recorded rather than inferred, so a consumer can always tell a number ACP
 * observed from one an engine asserted. ACP does not own the harness
 * ([[ADR-0026-agent-sandbox-runtime]]), so tokens can only ever be attested.
 */
export const CostSource = Schema.Literal('attested', 'metered')
export type CostSource = typeof CostSource.Type

export const CostEntry = Schema.Struct({
  entry_id: CostEntryId,
  workspace_id: WorkspaceId,
  work_id: WorkId,
  worker_id: Schema.optionalWith(WorkerId, { as: 'Option', nullable: true }),
  usage: ResourceUsage,
  source: CostSource,
  recorded_at: Timestamp,
})
export type CostEntry = typeof CostEntry.Type

export const ModelPrice = Schema.Struct({
  input_micro_usd_per_token: NonNegative,
  output_micro_usd_per_token: NonNegative,
  cached_input_micro_usd_per_token: NonNegative,
})
export type ModelPrice = typeof ModelPrice.Type

/** Prices are workspace policy, not protocol constants. */
export const PriceTable = Schema.Struct({
  workspace_id: WorkspaceId,
  models: Schema.Record({ key: Schema.String, value: ModelPrice }),
  cpu_micro_usd_per_second: NonNegative,
  mib_micro_usd_per_second: NonNegative,
  updated_at: Timestamp,
})
export type PriceTable = typeof PriceTable.Type

/** An absent budget means unbounded — enforcement needs no feature flag. */
export const Budget = Schema.Struct({
  limit_micro_usd: NonNegative,
  set_by: WorkerId,
  set_at: Timestamp,
})
export type Budget = typeof Budget.Type

/**
 * Derived from the entries, never authoritative over them. The row's CAS
 * version lives in `StoredRecord.version`, not here, so the accumulator can be
 * rebuilt without inventing a second version counter.
 */
export const CostRollup = Schema.Struct({
  work_id: WorkId,
  workspace_id: WorkspaceId,
  own_micro_usd: NonNegative,
  inclusive_micro_usd: NonNegative,
  budget: Schema.optionalWith(Budget, { as: 'Option', nullable: true }),
})
export type CostRollup = typeof CostRollup.Type
