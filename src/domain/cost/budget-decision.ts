/** @Acp.Domain.Cost.BudgetDecision — admission against every budget on the path */
import type { WorkId } from '../../protocol/schema/index.js'

export interface BudgetOnPath {
  readonly work_id: WorkId
  readonly limit_micro_usd: number
  readonly inclusive_micro_usd: number
}

export type Decision =
  | { readonly _tag: 'Admit' }
  | {
      readonly _tag: 'Refuse'
      readonly work_id: WorkId
      readonly limit_micro_usd: number
      readonly inclusive_micro_usd: number
    }

const admit: Decision = { _tag: 'Admit' }

/**
 * `path` runs from the unit outward to the workspace root, and **every** budget
 * on it must admit. Stopping at the nearest budget-carrying ancestor would let
 * a generous inner budget override a tighter outer one, which inverts the
 * containment subtree rollup exists to provide.
 *
 * Exhaustion is `>=`: spend equal to the limit has consumed the budget.
 */
export const decide = (path: readonly BudgetOnPath[]): Decision => {
  for (const budget of path) {
    if (budget.inclusive_micro_usd >= budget.limit_micro_usd) {
      return {
        _tag: 'Refuse',
        work_id: budget.work_id,
        limit_micro_usd: budget.limit_micro_usd,
        inclusive_micro_usd: budget.inclusive_micro_usd,
      }
    }
  }
  return admit
}
