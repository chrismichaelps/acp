---
type: module
path: '@root/src/protocol/schema/review.schema.ts'
fidelity: Active
domain: '[[Review]]'
grammar: '[[grammar/typescript]]'
depth_score: 0.58
depth_status: MEDIUM
tags: [module, medium]
aliases: [review.schema]
---

# Review Schema

## Purpose

Wire + domain shape of a [[Review]], the `RequestReview` payload, and optional
signed-approval evidence (spec §10.7, §12.11, §23).

## Interface

### Signatures

```typescript
export const Review: Schema.Struct<{
  id: ReviewId
  work_id: WorkId
  requested_by: WorkerId
  reviewer: optionalWith<WorkerId, Option>
  state: ReviewState
  requirements: Schema.Array<string>
  approval_signature: optionalWith<ReviewApprovalSignature, Option>
  created_at: Timestamp
}>
export const ReviewApprovalSignature: Schema.Struct<{
  algorithm: NonEmptyString
  key_id: NonEmptyString
  value: NonEmptyString
  signed_at: optionalWith<Timestamp, Option>
}>
export const RequestReviewPayload: Schema.Struct<{
  work_id
  requested_by
  reviewer?
  requirements
}>
export type Review = typeof Review.Type
```

## Algorithm

Struct over [[ids]] + [[common]] `ReviewState`. `reviewer` is `Option` (a review
may be open to any qualified reviewer). `approval_signature` is also `Option`;
unsigned approvals remain valid, while signed approvals may carry durable
reviewer-supplied evidence for later verification by a dedicated seam. The
schema records the signature algorithm, public key identifier, opaque signature
value, and optional signature timestamp. It does not verify cryptography or
accept private key material.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT approve while any `requirements` entry is unmet — service enforces, not schema.
- ❌ Do NOT treat `approval_signature` as verified cryptographic proof; it is
  supplied evidence until a verifier seam exists.
- ❌ Do NOT store private signing keys or secrets in review records.

## Depth

MEDIUM (0.58).

## Referenced by

[[event.schema]] · [[src/_MOC]] · [[acp-http-api-reviews]]
