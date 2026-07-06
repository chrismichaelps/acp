---
type: module
path: '@root/src/protocol/schema/review-comment.schema.ts'
fidelity: Active
domain: '[[ReviewComment]]'
grammar: '[[grammar/typescript]]'
depth_score: 0.45
depth_status: MEDIUM
tags: [module, medium, review]
aliases: [review-comment.schema, ReviewComment, CommentTarget]
---

# ReviewComment Schema

## Purpose

Wire + domain shape of a [[ReviewComment]] and its create payload. Diff-anchored review remarks
posted by reviewers on pull request artifacts (spec §14.2).

## Interface

### Signatures

```typescript
export const CommentTarget: Schema.Struct<{
  artifact_id: ArtifactId
  file: NonEmptyString
  line: Option<number>
  side: CommentSide
}>

export const ReviewComment: Schema.Struct<{
  id: ReviewCommentId
  review_id: ReviewId
  work_id: WorkId
  workspace_id: WorkspaceId
  author: WorkerId
  target: CommentTarget
  body: NonEmptyString
  state: CommentState
  in_reply_to: Option<ReviewCommentId>
  created_at: Timestamp
  resolved_at: Option<Timestamp>
}>

export const AddReviewCommentPayload: Schema.Struct<{
  review_id: ReviewId
  work_id: WorkId
  workspace_id: WorkspaceId
  target: CommentTarget
  body: NonEmptyString
  in_reply_to: Option<ReviewCommentId>
}>

export type ReviewComment = typeof ReviewComment.Type
export type CommentTarget = typeof CommentTarget.Type
export type AddReviewCommentPayload = typeof AddReviewCommentPayload.Type
```

## Algorithm

Struct over [[ids]] + [[common]]. `CommentTarget` pins a comment to a specific artifact file
and optional line number; `side` disambiguates old (base) vs new (head) side of a diff.
`state` tracks lifecycle: `open` → `resolved` or `outdated`. Timestamps are ISO 8601 strings.

## Grill Log

- Diff-anchored comment schema introduces `review_id` and `grill_id` promoted columns to indexed storage.
- `CommentState` supports `open | resolved | outdated`; `outdated` reserved for future stale-comment tracking.
- `line` is `Option<number>` to permit file-level comments with no specific line anchor.
- `in_reply_to` allows comment threads; initially optional, enforced by policy.

## Referenced by

[[checkpoint.schema]] · [[src/_MOC]]
