/** @Acp.Domain.Cost.Rollup.Test — own vs inclusive accumulation */
import { describe, expect, it } from 'vitest'
import { Option, Schema } from 'effect'
import {
  Timestamp,
  WorkId,
  WorkerId,
  WorkspaceId,
} from '../../protocol/schema/index.js'
import type { CostRollup } from '../../protocol/schema/index.js'
import {
  applyDescendant,
  applyOwn,
  emptyRollup,
  rebuildOwn,
} from './cost-rollup.js'

const workId = Schema.decodeUnknownSync(WorkId)('work_1')
const workspaceId = Schema.decodeUnknownSync(WorkspaceId)('workspace_1')
const base = emptyRollup(workId, workspaceId)

describe('cost rollup', () => {
  it('starts at zero with no budget', () => {
    expect(base.own_micro_usd).toBe(0)
    expect(base.inclusive_micro_usd).toBe(0)
    expect(Option.isNone(base.budget)).toBe(true)
  })

  it('applyOwn raises both own and inclusive', () => {
    const next = applyOwn(base, 500)
    expect(next.own_micro_usd).toBe(500)
    expect(next.inclusive_micro_usd).toBe(500)
  })

  it('applyDescendant raises only inclusive', () => {
    const next = applyDescendant(applyOwn(base, 500), 300)
    expect(next.own_micro_usd).toBe(500)
    expect(next.inclusive_micro_usd).toBe(800)
  })

  it('rebuildOwn restates own from entries and preserves descendant spend', () => {
    // Inclusive carries 400 of descendant spend; a rebuild must preserve it.
    const drifted = applyDescendant(applyOwn(base, 999), 400)
    const repaired = rebuildOwn(drifted, [100, 200])
    expect(repaired.own_micro_usd).toBe(300)
    expect(repaired.inclusive_micro_usd).toBe(700)
  })

  it('rebuildOwn on an empty entry list zeroes own spend', () => {
    const repaired = rebuildOwn(applyOwn(base, 50), [])
    expect(repaired.own_micro_usd).toBe(0)
    expect(repaired.inclusive_micro_usd).toBe(0)
  })

  it('preserves the budget across every operation', () => {
    const withBudget: CostRollup = {
      ...base,
      budget: Option.some({
        limit_micro_usd: 10,
        set_by: Schema.decodeUnknownSync(WorkerId)('agent_a'),
        set_at: Schema.decodeUnknownSync(Timestamp)('2026-08-08T10:00:00Z'),
      }),
    }
    expect(Option.isSome(applyOwn(withBudget, 1).budget)).toBe(true)
    expect(Option.isSome(applyDescendant(withBudget, 1).budget)).toBe(true)
    expect(Option.isSome(rebuildOwn(withBudget, [1]).budget)).toBe(true)
  })
})
