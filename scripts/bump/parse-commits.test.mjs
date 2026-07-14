// @Acp.Scripts.Bump.ParseCommits.Test — conventional commit evidence parsing
import { describe, expect, it } from 'vitest'
import { parseCommitLog, parseConventionalCommit } from './parse-commits.mjs'

describe('parseConventionalCommit', () => {
  it.each([
    ['feat(api): add route', 'feat', 'api', false],
    ['fix!: remove fallback', 'fix', null, true],
    ['perf(store)!: replace index', 'perf', 'store', true],
  ])('parses %s', (subject, type, scope, breaking) => {
    expect(parseConventionalCommit({ subject, body: '' })).toMatchObject({
      subject,
      type,
      scope,
      breaking,
    })
  })

  it.each([
    'BREAKING CHANGE: removed field',
    'BREAKING-CHANGE: changed wire type',
  ])('recognizes a %s trailer', (trailer) => {
    expect(
      parseConventionalCommit({
        subject: 'fix(protocol): adjust schema',
        body: `Context.\n\n${trailer}`,
      }).breaking,
    ).toBe(true)
  })

  it('preserves breaking evidence on a malformed subject', () => {
    expect(
      parseConventionalCommit({
        subject: 'Remove old transport',
        body: 'BREAKING CHANGE: transport removed',
      }),
    ).toMatchObject({ type: 'unknown', scope: null, breaking: true })
  })

  it('does not treat inline prose as a breaking trailer', () => {
    expect(
      parseConventionalCommit({
        subject: 'docs: explain trailers',
        body: 'Use BREAKING CHANGE: only at the beginning of a line.',
      }).breaking,
    ).toBe(false)
  })
})

describe('parseCommitLog', () => {
  it('parses record- and field-delimited subject/body pairs', () => {
    const raw =
      '\u001efeat: add one\u001fBody one\n\u001efix: repair two\u001fBody two\n\nBREAKING-CHANGE: contract'
    expect(parseCommitLog(raw)).toEqual([
      expect.objectContaining({ type: 'feat', body: 'Body one\n' }),
      expect.objectContaining({ type: 'fix', breaking: true }),
    ])
  })

  it('returns no commits for empty output', () => {
    expect(parseCommitLog('')).toEqual([])
  })

  it('rejects a record without a field separator', () => {
    expect(() => parseCommitLog('\u001efeat: incomplete')).toThrow(
      /malformed git log record/,
    )
  })
})
