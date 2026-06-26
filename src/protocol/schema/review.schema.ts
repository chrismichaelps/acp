/** @Acp.Protocol.Review — wire + domain shape of a Review */
import { Schema } from 'effect'
import { ReviewId, WorkId, WorkerId } from './ids.js'
import { ReviewState, Timestamp } from './common.js'

export const Review = Schema.Struct({
  id: ReviewId,
  work_id: WorkId,
  requested_by: WorkerId,
  reviewer: Schema.optionalWith(WorkerId, { as: 'Option', nullable: true }),
  state: ReviewState,
  requirements: Schema.Array(Schema.String),
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
