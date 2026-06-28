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

Wire + domain shape of a [[Review]] and the `RequestReview` payload (spec §10.7, §12.11).

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
  created_at: Timestamp
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

Struct over [[ids]] + [[common]] `ReviewState`. `reviewer` is `Option` (a review may
be open to any qualified reviewer).

## Negative Logic (Prohibited Paths)

- ❌ Do NOT approve while any `requirements` entry is unmet — service enforces, not schema.

## Depth

MEDIUM (0.58).

## Referenced by

[[event.schema]] · [[src/_MOC]]
