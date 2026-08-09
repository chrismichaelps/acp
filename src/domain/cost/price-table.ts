/** @Acp.Domain.Cost.PriceTable — usage priced by workspace policy */
import { Option } from 'effect'
import type { PriceTable, ResourceUsage } from '../../protocol/schema/index.js'
import { hasTokens } from './resource-usage.js'

export type PriceResult =
  | { readonly _tag: 'Priced'; readonly micro_usd: number }
  | { readonly _tag: 'Unpriced'; readonly model: string }

/** Stands in for a model name when tokens are reported without one. */
export const UNNAMED_MODEL = '<unnamed>'

const priced = (micro_usd: number): PriceResult => ({
  _tag: 'Priced',
  micro_usd,
})

const computeCost = (usage: ResourceUsage, table: PriceTable): number =>
  usage.cpu_seconds * table.cpu_micro_usd_per_second +
  usage.mib_seconds * table.mib_micro_usd_per_second

/**
 * Prices one usage. Compute always prices — its rates are workspace-wide.
 * Tokens price only against a named, known model: reporting tokens under an
 * unknown name, or under no name at all, would otherwise be a free channel
 * straight past any budget.
 */
export const priceOf = (
  usage: ResourceUsage,
  table: PriceTable,
): PriceResult => {
  const compute = computeCost(usage, table)
  if (!hasTokens(usage)) return priced(compute)

  const model = Option.getOrUndefined(usage.model)
  if (model === undefined) return { _tag: 'Unpriced', model: UNNAMED_MODEL }

  // `hasOwnProperty` rather than a bare index: `table.models` is decoded from a
  // `Schema.Record`, and a model literally named `constructor` would otherwise
  // resolve to a prototype member instead of a rate.
  const rates = Object.prototype.hasOwnProperty.call(table.models, model)
    ? table.models[model]
    : undefined
  if (rates === undefined) return { _tag: 'Unpriced', model }

  return priced(
    compute +
      usage.input_tokens * rates.input_micro_usd_per_token +
      usage.output_tokens * rates.output_micro_usd_per_token +
      usage.cached_input_tokens * rates.cached_input_micro_usd_per_token,
  )
}
