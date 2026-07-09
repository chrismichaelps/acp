/** @Acp.App.Cli.GhReconcile.Test — merge-gate + decision helpers */
import { describe, expect, it } from 'vitest'
import {
  evaluateMergeGate,
  formatDecision,
  type WireResume,
} from './gh-reconcile.js'

const emptyResume: WireResume = {
  reviews: [],
  open_comments: [],
  latest_grill: null,
}

describe('evaluateMergeGate', () => {
  it('passes when a review is approved, the grill passed, and no comments are open', () => {
    const gate = evaluateMergeGate({
      reviews: [{ state: 'approved' }],
      open_comments: [],
      latest_grill: { state: 'passed' },
    })
    expect(gate.ok).toBe(true)
    expect(gate.reasons).toEqual([])
  })

  it('collects a reason for each unmet condition', () => {
    const gate = evaluateMergeGate({
      reviews: [{ state: 'needs_review' }],
      open_comments: [{}, {}],
      latest_grill: { state: 'failed' },
    })
    expect(gate.ok).toBe(false)
    expect(gate.reasons).toContain('review not approved')
    expect(gate.reasons).toContain('grill not passed')
    expect(gate.reasons.some((r) => r.includes('unresolved'))).toBe(true)
  })

  it('treats a null grill as not passed', () => {
    const gate = evaluateMergeGate({
      ...emptyResume,
      reviews: [{ state: 'approved' }],
    })
    expect(gate.ok).toBe(false)
    expect(gate.reasons).toContain('grill not passed')
  })
})

describe('formatDecision', () => {
  it('summarizes a passing gate with the grill outcome and unresolved count', () => {
    const summary = formatDecision({
      reviews: [{ state: 'approved' }],
      open_comments: [],
      latest_grill: { state: 'passed' },
    })
    expect(summary).toContain('passed')
    expect(summary).toContain('0 unresolved')
  })

  it('reports none when there is no grill or review', () => {
    const summary = formatDecision(emptyResume)
    expect(summary).toContain('none')
  })
})
