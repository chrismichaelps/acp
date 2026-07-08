/** @Acp.Infra.GitHub.Types.Test — PR ref parsing */
import { Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { parsePrRef } from './github-types.js'

describe('parsePrRef', () => {
  it('parses a full PR URL', () => {
    const r = parsePrRef('https://github.com/chrismichaelps/acp/pull/251')
    expect(Either.isRight(r) && r.right).toEqual({
      owner: 'chrismichaelps',
      repo: 'acp',
      number: 251,
    })
  })

  it('parses the short owner/repo#number form', () => {
    const r = parsePrRef('chrismichaelps/acp#7')
    expect(Either.isRight(r) && r.right).toEqual({
      owner: 'chrismichaelps',
      repo: 'acp',
      number: 7,
    })
  })

  it('fails on an unrecognized ref', () => {
    expect(Either.isLeft(parsePrRef('not-a-pr'))).toBe(true)
  })
})
