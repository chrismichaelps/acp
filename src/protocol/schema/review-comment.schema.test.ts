import { describe, it, expect } from 'vitest'
import { Schema, Option } from 'effect'
import { ReviewComment } from './review-comment.schema.js'

describe('ReviewComment schema', () => {
  it('decodes a file-level comment with no line', () => {
    const decoded = Schema.decodeUnknownSync(ReviewComment)({
      id: 'reviewcomment_1',
      review_id: 'review_1',
      work_id: 'work_1',
      workspace_id: 'ws_1',
      author: 'worker_1',
      target: {
        artifact_id: 'artifact_1',
        file: 'src/a.ts',
        line: null,
        side: 'new',
      },
      body: 'needs a test',
      state: 'open',
      in_reply_to: null,
      created_at: '2026-07-06T10:00:00Z',
      resolved_at: null,
    })
    expect(Option.isNone(decoded.target.line)).toBe(true)
    expect(decoded.state).toBe('open')
  })
})
