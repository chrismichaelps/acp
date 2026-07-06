/** @Acp.Protocol.ReviewComment — diff-anchored review remark */
import { Schema } from 'effect'
import {
  ReviewCommentId,
  ReviewId,
  WorkId,
  WorkspaceId,
  WorkerId,
  ArtifactId,
} from './ids.js'
import { CommentState, CommentSide, Timestamp } from './common.js'

export const CommentTarget = Schema.Struct({
  artifact_id: ArtifactId,
  file: Schema.NonEmptyString,
  line: Schema.optionalWith(Schema.Number, { as: 'Option', nullable: true }),
  side: CommentSide,
})
export type CommentTarget = typeof CommentTarget.Type

export const ReviewComment = Schema.Struct({
  id: ReviewCommentId,
  review_id: ReviewId,
  work_id: WorkId,
  workspace_id: WorkspaceId,
  author: WorkerId,
  target: CommentTarget,
  body: Schema.NonEmptyString,
  state: CommentState,
  in_reply_to: Schema.optionalWith(ReviewCommentId, {
    as: 'Option',
    nullable: true,
  }),
  created_at: Timestamp,
  resolved_at: Schema.optionalWith(Timestamp, { as: 'Option', nullable: true }),
})
export type ReviewComment = typeof ReviewComment.Type

export const AddReviewCommentPayload = Schema.Struct({
  review_id: ReviewId,
  work_id: WorkId,
  workspace_id: WorkspaceId,
  target: CommentTarget,
  body: Schema.NonEmptyString,
  in_reply_to: Schema.optionalWith(ReviewCommentId, {
    as: 'Option',
    nullable: true,
  }),
})
export type AddReviewCommentPayload = typeof AddReviewCommentPayload.Type
