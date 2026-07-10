/** @Acp.Protocol.Resume — compact work handoff packet */
import { Schema } from 'effect'
import { Artifact } from './artifact.schema.js'
import { Checkpoint } from './checkpoint.schema.js'
import { Grill } from './grill.schema.js'
import { Review } from './review.schema.js'
import { ReviewComment } from './review-comment.schema.js'
import { WorkUnit } from './work-unit.schema.js'

/** A reference to inline content elided from the packet under a token budget. */
export const ResumeElidedRefs = Schema.Struct({
  count: Schema.Number,
  ids: Schema.Array(Schema.String),
})
export type ResumeElidedRefs = typeof ResumeElidedRefs.Type

/** What a `?budget=` request dropped to references instead of inlining. */
export const ResumeElision = Schema.Struct({
  artifacts: Schema.optional(ResumeElidedRefs),
  reviews: Schema.optional(ResumeElidedRefs),
})
export type ResumeElision = typeof ResumeElision.Type

export const WorkResumePacket = Schema.Struct({
  work: WorkUnit,
  latest_checkpoint: Schema.optionalWith(Checkpoint, {
    as: 'Option',
    nullable: true,
  }),
  artifacts: Schema.Array(Artifact),
  reviews: Schema.Array(Review),
  open_comments: Schema.Array(ReviewComment),
  latest_grill: Schema.optionalWith(Grill, {
    as: 'Option',
    nullable: true,
  }),
  // Present only under a `?budget=` request; omitted for full packets so existing
  // consumers (and the merge gate) see the unchanged shape.
  elided: Schema.optional(ResumeElision),
})
export type WorkResumePacket = typeof WorkResumePacket.Type
