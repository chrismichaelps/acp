/** @Acp.Domain.Identity.Assertion — Ed25519 provenance for worker claims */
import { createPublicKey, verify as cryptoVerify } from 'node:crypto'
import type { KeyObject } from 'node:crypto'
import { Either } from 'effect'

/**
 * The state-changing claims whose attribution the review and grill gates rest
 * on. Reads are deliberately absent: signing them would add verification cost
 * to prove authorship of an action that changes nothing.
 */
export type AssertionAction =
  'worker.register' | 'work.claim' | 'review.verdict' | 'grill.answer'

export interface AssertionClaims {
  readonly workerId: string
  readonly action: AssertionAction
  readonly targetId: string
  /** ISO-8601 instant the worker signed at. */
  readonly timestamp: string
}

export interface WorkerAssertion extends AssertionClaims {
  /** Base64 Ed25519 signature over `canonicalAssertionPayload`. */
  readonly signature: string
}

/**
 * The exact bytes a worker signs.
 *
 * JSON with a fixed field order rather than a delimiter-joined string: joining
 * on a separator lets a crafted field shift the boundaries, so a worker id of
 * `agent_a|work.claim` could forge a claim about another target. JSON escapes
 * the delimiters, so no field value can impersonate the structure.
 */
export const canonicalAssertionPayload = (claims: AssertionClaims): string =>
  JSON.stringify([
    'acp.worker-assertion.v1',
    claims.workerId,
    claims.action,
    claims.targetId,
    claims.timestamp,
  ])

/** Exports a public key in the base64 SPKI form the host stores. */
export const publicKeyToBase64 = (key: KeyObject): string =>
  key.export({ type: 'spki', format: 'der' }).toString('base64')

export interface VerifyInput {
  /** Base64 SPKI public key, as recorded on the worker at registration. */
  readonly publicKey: string
  readonly assertion: WorkerAssertion
  readonly now: string
  readonly maxSkewSeconds: number
}

/**
 * Verifies a worker assertion.
 *
 * Every claim is bound into the signature, so a valid assertion cannot be
 * lifted onto a different worker, action, or target. The timestamp is bound too
 * and must sit inside the skew window, which bounds how long a captured
 * assertion stays replayable against its *own* target.
 *
 * Returns a reason rather than throwing: malformed keys, signatures, and
 * timestamps are all untrusted input arriving over the network, and a crash is
 * not an acceptable answer to any of them. See
 * [[ADR-0024-worker-identity-provenance]].
 */
export const verifyWorkerAssertion = (
  input: VerifyInput,
): Either.Either<void, string> => {
  const signedAt = Date.parse(input.assertion.timestamp)
  const at = Date.parse(input.now)
  if (Number.isNaN(signedAt))
    return Either.left('unparseable assertion timestamp')
  if (Number.isNaN(at)) return Either.left('unparseable current time')

  const skewMs = Math.abs(at - signedAt)
  if (skewMs > input.maxSkewSeconds * 1000) {
    return Either.left(
      `assertion timestamp is outside the ${String(input.maxSkewSeconds)}s skew window`,
    )
  }

  if (input.assertion.signature === '') return Either.left('missing signature')

  try {
    const key = createPublicKey({
      key: Buffer.from(input.publicKey, 'base64'),
      format: 'der',
      type: 'spki',
    })
    const ok = cryptoVerify(
      null,
      Buffer.from(canonicalAssertionPayload(input.assertion), 'utf8'),
      key,
      Buffer.from(input.assertion.signature, 'base64'),
    )
    return ok
      ? Either.right(undefined)
      : Either.left('signature does not verify')
  } catch (cause) {
    // A malformed key or signature is a rejection, never a defect.
    return Either.left(`signature could not be checked: ${String(cause)}`)
  }
}
