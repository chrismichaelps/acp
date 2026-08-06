/** @Acp.Domain.Identity.Header.Test — decoding provenance off the wire */
import { describe, expect, it } from 'vitest'
import { Either, Option } from 'effect'
import {
  ACP_ASSERTION_HEADER,
  decodeAssertionHeader,
} from './assertion-header.js'

const claims = {
  worker_id: 'agent_a',
  action: 'work.claim',
  target_id: 'work_1',
  timestamp: '2026-08-06T10:00:00Z',
  signature: 'c2ln',
}

const encode = (value: unknown) =>
  Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')

const decode = (raw: Option.Option<string>) => decodeAssertionHeader(raw)

describe('assertion header', () => {
  it('names a header that sits beside the bearer token', () => {
    expect(ACP_ASSERTION_HEADER).toBe('x-acp-assertion')
  })

  it('decodes a well-formed assertion', () => {
    const result = decode(Option.some(encode(claims)))
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
      expect(Option.getOrThrow(result.right).target_id).toBe('work_1')
    }
  })

  it('reports absence as no assertion rather than an error', () => {
    const result = decode(Option.none())
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) expect(Option.isNone(result.right)).toBe(true)
  })

  // A header that is present but unreadable must never be mistaken for one
  // that was never sent: absent means "no proof offered", malformed means
  // "proof offered and broken", and only the first is permitted unenforced.
  it.each([
    ['not base64 !!!', 'garbage'],
    ['', 'empty'],
    [Buffer.from('not json', 'utf8').toString('base64url'), 'non-JSON'],
    [Buffer.from('[]', 'utf8').toString('base64url'), 'wrong JSON shape'],
  ])(
    'rejects a malformed header (%s) rather than treating it as absent',
    (raw) => {
      expect(Either.isLeft(decode(Option.some(raw)))).toBe(true)
    },
  )

  it('rejects an assertion missing a required field', () => {
    const { signature, ...withoutSignature } = claims
    expect(signature).toBeDefined()
    expect(Either.isLeft(decode(Option.some(encode(withoutSignature))))).toBe(
      true,
    )
  })

  it('rejects an unknown action rather than passing it through', () => {
    const result = decode(
      Option.some(encode({ ...claims, action: 'work.delete' })),
    )
    expect(Either.isLeft(result)).toBe(true)
  })

  it('round-trips every field it decodes', () => {
    const result = decode(Option.some(encode(claims)))
    if (Either.isRight(result)) {
      const decoded = Option.getOrThrow(result.right)
      expect(decoded.worker_id).toBe('agent_a')
      expect(decoded.action).toBe('work.claim')
      expect(decoded.target_id).toBe('work_1')
      expect(decoded.timestamp).toBe('2026-08-06T10:00:00Z')
      expect(decoded.signature).toBe('c2ln')
    }
  })
})
