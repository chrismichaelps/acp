/** @Acp.App.Server.ResumeWorkspace.Test — salience budgeting + ETag digest */
import { describe, expect, it } from 'vitest'
import type { Artifact, Review, ReviewId } from '../../protocol/schema/index.js'
import {
  budgetResume,
  etagOf,
  parseBudget,
  resumeDigest,
} from './resume-workspace.js'

const artifact = (id: string, createdAt: string): Artifact =>
  ({ id, created_at: createdAt }) as unknown as Artifact

const review = (id: string, createdAt: string, state: string): Review =>
  ({ id, created_at: createdAt, state }) as unknown as Review

const ids = (values: readonly { readonly id: string }[]): readonly string[] =>
  values.map((value) => value.id)

describe('parseBudget', () => {
  it('returns null for missing/empty/invalid values', () => {
    expect(parseBudget(undefined)).toBeNull()
    expect(parseBudget('')).toBeNull()
    expect(parseBudget('-1')).toBeNull()
    expect(parseBudget('2.5')).toBeNull()
    expect(parseBudget('abc')).toBeNull()
  })

  it('parses a non-negative integer', () => {
    expect(parseBudget('0')).toBe(0)
    expect(parseBudget('5')).toBe(5)
  })
})

describe('budgetResume', () => {
  const artifacts = [
    artifact('a_old', '2026-07-01T00:00:00.000Z'),
    artifact('a_new', '2026-07-03T00:00:00.000Z'),
    artifact('a_mid', '2026-07-02T00:00:00.000Z'),
  ]

  it('returns everything and no elision when budget is null or negative', () => {
    for (const budget of [null, -1]) {
      const result = budgetResume(artifacts, [], null, budget)
      expect(result.artifacts).toHaveLength(3)
      expect(result.elided).toBeUndefined()
    }
  })

  it('keeps the most-recent N artifacts and elides the rest to refs', () => {
    const result = budgetResume(artifacts, [], null, 2)
    expect(ids(result.artifacts)).toEqual(['a_new', 'a_mid'])
    expect(result.elided?.artifacts).toEqual({ count: 1, ids: ['a_old'] })
    expect(result.elided?.reviews).toBeUndefined()
  })

  it('pins an approved review even when the budget is 0', () => {
    const reviews = [
      review('r_req', '2026-07-01T00:00:00.000Z', 'requested'),
      review('r_appr', '2026-07-02T00:00:00.000Z', 'approved'),
    ]
    const result = budgetResume([], reviews, null, 0)
    expect(ids(result.reviews)).toEqual(['r_appr'])
    expect(result.elided?.reviews).toEqual({ count: 1, ids: ['r_req'] })
  })

  it('pins the review tied to the latest grill', () => {
    const reviews = [
      review('r_a', '2026-07-01T00:00:00.000Z', 'requested'),
      review('r_grilled', '2026-07-01T00:00:00.000Z', 'requested'),
    ]
    const result = budgetResume([], reviews, 'r_grilled' as ReviewId, 0)
    expect(ids(result.reviews)).toEqual(['r_grilled'])
    expect(result.elided?.reviews).toEqual({ count: 1, ids: ['r_a'] })
  })

  it('fills remaining budget slots with the most-recent non-pinned reviews', () => {
    const reviews = [
      review('r_appr', '2026-07-01T00:00:00.000Z', 'approved'),
      review('r_new', '2026-07-04T00:00:00.000Z', 'requested'),
      review('r_old', '2026-07-02T00:00:00.000Z', 'requested'),
    ]
    const result = budgetResume([], reviews, null, 2)
    // approved is pinned; one slot left goes to the most-recent non-pinned.
    expect(ids(result.reviews)).toEqual(['r_new', 'r_appr'])
    expect(result.elided?.reviews).toEqual({ count: 1, ids: ['r_old'] })
  })
})

describe('resumeDigest / etagOf', () => {
  it('is stable for identical input', () => {
    expect(resumeDigest('packet', 5)).toBe(resumeDigest('packet', 5))
  })

  it('changes when the budget changes', () => {
    expect(resumeDigest('packet', 5)).not.toBe(resumeDigest('packet', null))
  })

  it('changes when the encoded packet changes', () => {
    expect(resumeDigest('packet-a', 5)).not.toBe(resumeDigest('packet-b', 5))
  })

  it('quotes the digest as an entity tag', () => {
    expect(etagOf('abc')).toBe('"abc"')
  })
})
