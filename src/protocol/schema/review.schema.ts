/** @Acp.Protocol.Review — wire + domain shape of a Review */
import { Schema } from 'effect'
import { ReviewId, WorkId, WorkerId } from './ids.js'
import { ReviewState, Timestamp } from './common.js'

export const ReviewApprovalSignature = Schema.Struct({
  algorithm: Schema.NonEmptyString,
  key_id: Schema.NonEmptyString,
  value: Schema.NonEmptyString,
  signed_at: Schema.optionalWith(Timestamp, { as: 'Option', nullable: true }),
})
export type ReviewApprovalSignature = typeof ReviewApprovalSignature.Type

export const Review = Schema.Struct({
  id: ReviewId,
  work_id: WorkId,
  requested_by: WorkerId,
  reviewer: Schema.optionalWith(WorkerId, { as: 'Option', nullable: true }),
  state: ReviewState,
  requirements: Schema.Array(Schema.String),
  approval_signature: Schema.optionalWith(ReviewApprovalSignature, {
    as: 'Option',
    nullable: true,
  }),
  created_at: Timestamp,
})
export type Review = typeof Review.Type

export const RequestReviewPayload = Schema.Struct({
  work_id: WorkId,
  requested_by: WorkerId,
  reviewer: Schema.optionalWith(WorkerId, { as: 'Option', nullable: true }),
  requirements: Schema.Array(Schema.String),
})
export type RequestReviewPayload = typeof RequestReviewPayload.Type
