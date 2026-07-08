/** @Acp.App.Cli.ReviewCommentCommands.Test — review-comment parser cases */
import { Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { parseArgs, type CliRequest } from './commands.js'

const right = (argv: readonly string[]): CliRequest => {
  const parsed = parseArgs(argv)
  if (Either.isLeft(parsed)) {
    throw new Error(`expected Right, got: ${parsed.left.message}`)
  }
  return parsed.right
}

describe('review comment command parsing', () => {
  it('parses a diff-anchored add with a numeric line', () => {
    const req = right([
      'review',
      'comment',
      '--review',
      'review_1',
      '--work',
      'work_1',
      '--workspace',
      'workspace_1',
      '--artifact',
      'artifact_1',
      '--file',
      'src/app.ts',
      '--side',
      'new',
      '--body',
      'Never taken.',
      '--line',
      '42',
      '--reply-to',
      'reviewcomment_0',
    ])

    expect(req.method).toBe('POST')
    expect(req.path).toBe('/v1/reviews/review_1/comments')
    expect(req.body).toEqual({
      review_id: 'review_1',
      work_id: 'work_1',
      workspace_id: 'workspace_1',
      target: {
        artifact_id: 'artifact_1',
        file: 'src/app.ts',
        side: 'new',
        line: 42,
      },
      body: 'Never taken.',
      in_reply_to: 'reviewcomment_0',
    })
  })

  it('omits optional line/reply-to when absent', () => {
    const req = right([
      'review',
      'comment',
      '--review',
      'review_1',
      '--work',
      'work_1',
      '--workspace',
      'workspace_1',
      '--artifact',
      'artifact_1',
      '--file',
      'src/app.ts',
      '--side',
      'old',
      '--body',
      'Question.',
    ])
    const body = req.body as { target: Record<string, unknown> }
    expect(body.target).toEqual({
      artifact_id: 'artifact_1',
      file: 'src/app.ts',
      side: 'old',
    })
    expect('in_reply_to' in (req.body as object)).toBe(false)
  })

  it('parses resolve and reopen by comment id', () => {
    expect(right(['review', 'comment', 'resolve', 'reviewcomment_9'])).toEqual({
      method: 'POST',
      path: '/v1/review-comments/reviewcomment_9/resolve',
      label: 'review comment resolve',
    })
    expect(right(['review', 'comment', 'reopen', 'reviewcomment_9'])).toEqual({
      method: 'POST',
      path: '/v1/review-comments/reviewcomment_9/reopen',
      label: 'review comment reopen',
    })
  })

  it('lists by review or by work', () => {
    expect(
      right(['review', 'comment', 'list', '--review', 'review_1']).path,
    ).toBe('/v1/reviews/review_1/comments')
    expect(right(['review', 'comment', 'list', '--work', 'work_1']).path).toBe(
      '/v1/work/work_1/review-comments',
    )
  })

  it('fails add when a required flag is missing', () => {
    const parsed = parseArgs([
      'review',
      'comment',
      '--review',
      'review_1',
      '--work',
      'work_1',
    ])
    expect(Either.isLeft(parsed)).toBe(true)
  })
})
