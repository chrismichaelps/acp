/** @Acp.Protocol.Resume — compact work handoff packet */
import { Schema } from 'effect'
import { Artifact } from './artifact.schema.js'
import { Checkpoint } from './checkpoint.schema.js'
import { Review } from './review.schema.js'
import { WorkUnit } from './work-unit.schema.js'

export const WorkResumePacket = Schema.Struct({
  work: WorkUnit,
  latest_checkpoint: Schema.optionalWith(Checkpoint, {
    as: 'Option',
    nullable: true,
  }),
  artifacts: Schema.Array(Artifact),
  reviews: Schema.Array(Review),
})
export type WorkResumePacket = typeof WorkResumePacket.Type
