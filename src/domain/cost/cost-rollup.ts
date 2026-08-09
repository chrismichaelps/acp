/** @Acp.Domain.Cost.Rollup — derived own/inclusive spend accumulators */
import { Option } from 'effect'
import type {
  CostRollup,
  WorkId,
  WorkspaceId,
} from '../../protocol/schema/index.js'

export const emptyRollup = (
  workId: WorkId,
  workspaceId: WorkspaceId,
): CostRollup => ({
  work_id: workId,
  workspace_id: workspaceId,
  own_micro_usd: 0,
  inclusive_micro_usd: 0,
  budget: Option.none(),
})

/** Spend by this unit itself: raises both counters. */
export const applyOwn = (
  rollup: CostRollup,
  deltaMicroUsd: number,
): CostRollup => ({
  ...rollup,
  own_micro_usd: rollup.own_micro_usd + deltaMicroUsd,
  inclusive_micro_usd: rollup.inclusive_micro_usd + deltaMicroUsd,
})

/** Spend by a descendant: raises only the subtree total. */
export const applyDescendant = (
  rollup: CostRollup,
  deltaMicroUsd: number,
): CostRollup => ({
  ...rollup,
  inclusive_micro_usd: rollup.inclusive_micro_usd + deltaMicroUsd,
})

/**
 * Restates `own` from the entries that are the source of truth, and shifts
 * `inclusive` by the same delta so descendant spend already folded in survives
 * the repair. This is the path that makes denormalising money defensible: a
 * drifted accumulator is repairable rather than permanently wrong.
 */
export const rebuildOwn = (
  rollup: CostRollup,
  entryPrices: readonly number[],
): CostRollup => {
  const own = entryPrices.reduce((total, price) => total + price, 0)
  return {
    ...rollup,
    own_micro_usd: own,
    inclusive_micro_usd:
      rollup.inclusive_micro_usd - rollup.own_micro_usd + own,
  }
}
