/** @Acp.App.Cli.GrillCommands.Test — grill gate parser cases */
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

describe('grill command parsing', () => {
  it('opens a grill from review/work/workspace', () => {
    const req = right([
      'grill',
      'open',
      '--review',
      'review_1',
      '--work',
      'work_1',
      '--workspace',
      'workspace_1',
    ])
    expect(req).toEqual({
      method: 'POST',
      path: '/v1/reviews/review_1/grill',
      body: {
        review_id: 'review_1',
        work_id: 'work_1',
        workspace_id: 'workspace_1',
      },
      label: 'grill open',
    })
  })

  it('asks a blocker question on a grill', () => {
    const req = right([
      'grill',
      'ask',
      'grill_1',
      '--severity',
      'blocker',
      '--prompt',
      'Why is this safe?',
    ])
    expect(req.path).toBe('/v1/grills/grill_1/questions')
    expect(req.body).toEqual({
      prompt: 'Why is this safe?',
      severity: 'blocker',
    })
  })

  it('answers a question', () => {
    const req = right([
      'grill',
      'answer',
      'grillquestion_1',
      '--answer',
      'CAS rejects stale writes.',
    ])
    expect(req.path).toBe('/v1/grill-questions/grillquestion_1/answer')
    expect(req.body).toEqual({ answer: 'CAS rejects stale writes.' })
  })

  it('maps --accept and --reject to the verdict body', () => {
    expect(
      right(['grill', 'verdict', 'grillquestion_1', '--accept']).body,
    ).toEqual({ verdict: 'accepted' })
    expect(
      right(['grill', 'verdict', 'grillquestion_1', '--reject']).body,
    ).toEqual({ verdict: 'rejected' })
  })

  it('rejects a verdict without exactly one of --accept/--reject', () => {
    expect(
      Either.isLeft(parseArgs(['grill', 'verdict', 'grillquestion_1'])),
    ).toBe(true)
    expect(
      Either.isLeft(
        parseArgs([
          'grill',
          'verdict',
          'grillquestion_1',
          '--accept',
          '--reject',
        ]),
      ),
    ).toBe(true)
  })

  it('evaluates, gets, and lists grills', () => {
    expect(right(['grill', 'evaluate', 'grill_1'])).toEqual({
      method: 'POST',
      path: '/v1/grills/grill_1/evaluate',
      label: 'grill evaluate',
    })
    expect(right(['grill', 'get', 'grill_1'])).toEqual({
      method: 'GET',
      path: '/v1/grills/grill_1',
      label: 'grill get',
    })
    expect(right(['grill', 'list', '--review', 'review_1']).path).toBe(
      '/v1/reviews/review_1/grills',
    )
  })
})
