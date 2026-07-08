import { describe, it, expect } from 'vitest'
import { Schema, Option } from 'effect'
import { Grill, GrillQuestion } from './grill.schema.js'

describe('Grill schema', () => {
  it('decodes an open grill', () => {
    const g = Schema.decodeUnknownSync(Grill)({
      id: 'grill_1',
      review_id: 'review_1',
      work_id: 'work_1',
      workspace_id: 'ws_1',
      opened_by: 'worker_1',
      state: 'open',
      created_at: '2026-07-06T10:00:00Z',
      closed_at: null,
    })
    expect(g.state).toBe('open')
  })
  it('decodes a pending blocker question', () => {
    const q = Schema.decodeUnknownSync(GrillQuestion)({
      id: 'grillquestion_1',
      grill_id: 'grill_1',
      prompt: 'Why is this CAS-safe?',
      severity: 'blocker',
      answer: null,
      answered_by: null,
      verdict: 'pending',
      created_at: '2026-07-06T10:00:00Z',
      answered_at: null,
      decided_at: null,
    })
    expect(q.verdict).toBe('pending')
    expect(Option.isNone(q.answer)).toBe(true)
  })
})
