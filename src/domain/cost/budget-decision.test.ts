/** @Acp.Domain.Cost.BudgetDecision.Test — every budget on the path must admit */
import { describe, expect, it } from 'vitest'
import { Schema } from 'effect'
import { WorkId } from '../../protocol/schema/index.js'
import { decide } from './budget-decision.js'

const child = Schema.decodeUnknownSync(WorkId)('work_child')
const root = Schema.decodeUnknownSync(WorkId)('work_root')

describe('decide', () => {
  it('admits when no budget is on the path', () => {
    expect(decide([])).toEqual({ _tag: 'Admit' })
  })

  it('admits when spend is below every limit', () => {
    expect(
      decide([
        { work_id: child, limit_micro_usd: 100, inclusive_micro_usd: 40 },
        { work_id: root, limit_micro_usd: 500, inclusive_micro_usd: 300 },
      ]),
    ).toEqual({ _tag: 'Admit' })
  })

  it('refuses at exactly the limit — a spent budget is exhausted', () => {
    expect(
      decide([
        { work_id: child, limit_micro_usd: 100, inclusive_micro_usd: 100 },
      ]),
    ).toEqual({
      _tag: 'Refuse',
      work_id: child,
      limit_micro_usd: 100,
      inclusive_micro_usd: 100,
    })
  })

  it('refuses on an outer budget even when the inner one is generous', () => {
    // A generous inner budget must not override a tighter outer one, or the
    // containment that subtree rollup exists to provide is inverted.
    expect(
      decide([
        { work_id: child, limit_micro_usd: 1_000_000, inclusive_micro_usd: 40 },
        { work_id: root, limit_micro_usd: 500, inclusive_micro_usd: 900 },
      ]),
    ).toEqual({
      _tag: 'Refuse',
      work_id: root,
      limit_micro_usd: 500,
      inclusive_micro_usd: 900,
    })
  })

  it('reports the nearest refusal first when several are exhausted', () => {
    const result = decide([
      { work_id: child, limit_micro_usd: 10, inclusive_micro_usd: 20 },
      { work_id: root, limit_micro_usd: 30, inclusive_micro_usd: 40 },
    ])
    expect(result).toMatchObject({ _tag: 'Refuse', work_id: child })
  })
})
