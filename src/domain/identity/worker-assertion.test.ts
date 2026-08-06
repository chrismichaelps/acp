/** @Acp.Domain.Identity.Assertion.Test — signature binding and replay resistance */
import { describe, expect, it } from 'vitest'
import { generateKeyPairSync, sign } from 'node:crypto'
import { Either } from 'effect'
import {
  canonicalAssertionPayload,
  publicKeyToBase64,
  verifyWorkerAssertion,
} from './worker-assertion.js'
import type { WorkerAssertion } from './worker-assertion.js'

const keys = () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  return { publicKey: publicKeyToBase64(publicKey), privateKey }
}

const alice = keys()
const mallory = keys()

const base = {
  workerId: 'agent_alice',
  action: 'work.claim' as const,
  targetId: 'work_1',
  timestamp: '2026-08-05T10:00:00Z',
}

const now = '2026-08-05T10:00:05Z'

/** Signs `over` with `privateKey`, producing a well-formed assertion. */
const signed = (
  over: Partial<typeof base> = {},
  privateKey = alice.privateKey,
): WorkerAssertion => {
  const claims = { ...base, ...over }
  const signature = sign(
    null,
    Buffer.from(canonicalAssertionPayload(claims), 'utf8'),
    privateKey,
  ).toString('base64')
  return { ...claims, signature }
}

const verify = (
  assertion: WorkerAssertion,
  publicKey = alice.publicKey,
  at = now,
) =>
  verifyWorkerAssertion({ publicKey, assertion, now: at, maxSkewSeconds: 60 })

describe('worker assertion — acceptance', () => {
  it('accepts a signature over its own claims', () => {
    expect(Either.isRight(verify(signed()))).toBe(true)
  })

  it('accepts a timestamp inside the skew window on either side', () => {
    expect(
      Either.isRight(verify(signed(), alice.publicKey, '2026-08-05T10:00:59Z')),
    ).toBe(true)
    expect(
      Either.isRight(verify(signed(), alice.publicKey, '2026-08-05T09:59:01Z')),
    ).toBe(true)
  })
})

describe('worker assertion — binding', () => {
  // Each field is bound into the signature, so a valid assertion cannot be
  // lifted onto a different worker, action, or target.
  it('rejects a signature replayed against a different target', () => {
    const stolen = { ...signed(), targetId: 'work_2' }
    expect(Either.isLeft(verify(stolen))).toBe(true)
  })

  it('rejects a signature replayed as a different action', () => {
    const stolen = { ...signed(), action: 'review.verdict' as const }
    expect(Either.isLeft(verify(stolen))).toBe(true)
  })

  it('rejects a signature claimed by a different worker', () => {
    const stolen = { ...signed(), workerId: 'agent_mallory' }
    expect(Either.isLeft(verify(stolen))).toBe(true)
  })

  it('rejects a tampered timestamp', () => {
    const stolen = { ...signed(), timestamp: '2026-08-05T10:00:01Z' }
    expect(Either.isLeft(verify(stolen))).toBe(true)
  })

  it('rejects a signature made with a different key', () => {
    expect(Either.isLeft(verify(signed({}, mallory.privateKey)))).toBe(true)
  })

  it('rejects a valid signature checked against the wrong public key', () => {
    expect(Either.isLeft(verify(signed(), mallory.publicKey))).toBe(true)
  })
})

describe('worker assertion — canonical payload', () => {
  // A delimiter-joined payload lets a crafted field shift the boundaries, so
  // that "agent_a|work.claim" as a worker id could forge another claim. The
  // encoding must make that impossible.
  it('does not let a crafted field impersonate another claim', () => {
    const a = canonicalAssertionPayload({
      ...base,
      workerId: 'agent_a',
      targetId: 'work_1',
    })
    const b = canonicalAssertionPayload({
      ...base,
      workerId: 'agent_a"work_1',
      targetId: '',
    })
    expect(a).not.toBe(b)
  })

  it('is deterministic for the same claims', () => {
    expect(canonicalAssertionPayload(base)).toBe(
      canonicalAssertionPayload(base),
    )
  })

  it('changes when any single field changes', () => {
    const baseline = canonicalAssertionPayload(base)
    expect(canonicalAssertionPayload({ ...base, workerId: 'x' })).not.toBe(
      baseline,
    )
    expect(canonicalAssertionPayload({ ...base, targetId: 'x' })).not.toBe(
      baseline,
    )
    expect(
      canonicalAssertionPayload({ ...base, action: 'grill.answer' }),
    ).not.toBe(baseline)
    expect(canonicalAssertionPayload({ ...base, timestamp: 'x' })).not.toBe(
      baseline,
    )
  })
})

describe('worker assertion — replay window', () => {
  it('rejects an assertion older than the skew window', () => {
    expect(
      Either.isLeft(verify(signed(), alice.publicKey, '2026-08-05T10:02:00Z')),
    ).toBe(true)
  })

  it('rejects an assertion from too far in the future', () => {
    expect(
      Either.isLeft(verify(signed(), alice.publicKey, '2026-08-05T09:58:00Z')),
    ).toBe(true)
  })
})

describe('worker assertion — malformed input', () => {
  it('rejects rather than throwing on a non-base64 signature', () => {
    const result = verify({ ...signed(), signature: 'not base64 !!!' })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects rather than throwing on a malformed public key', () => {
    expect(Either.isLeft(verify(signed(), 'not-a-key'))).toBe(true)
  })

  it('rejects rather than throwing on an unparseable timestamp', () => {
    expect(Either.isLeft(verify(signed({ timestamp: 'yesterday' })))).toBe(true)
  })

  it('rejects an empty signature', () => {
    expect(Either.isLeft(verify({ ...signed(), signature: '' }))).toBe(true)
  })
})
