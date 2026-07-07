/** @Acp.Protocol.Grill — forced senior-question review gate */
import { Schema } from 'effect'
import {
  GrillId,
  GrillQuestionId,
  ReviewId,
  WorkId,
  WorkspaceId,
  WorkerId,
} from './ids.js'
import {
  GrillState,
  QuestionSeverity,
  QuestionVerdict,
  Timestamp,
} from './common.js'

export const Grill = Schema.Struct({
  id: GrillId,
  review_id: ReviewId,
  work_id: WorkId,
  workspace_id: WorkspaceId,
  opened_by: WorkerId,
  state: GrillState,
  created_at: Timestamp,
  closed_at: Schema.optionalWith(Timestamp, { as: 'Option', nullable: true }),
})
export type Grill = typeof Grill.Type

export const GrillQuestion = Schema.Struct({
  id: GrillQuestionId,
  grill_id: GrillId,
  prompt: Schema.NonEmptyString,
  severity: QuestionSeverity,
  answer: Schema.optionalWith(Schema.String, { as: 'Option', nullable: true }),
  answered_by: Schema.optionalWith(WorkerId, { as: 'Option', nullable: true }),
  verdict: QuestionVerdict,
  created_at: Timestamp,
  answered_at: Schema.optionalWith(Timestamp, { as: 'Option', nullable: true }),
  decided_at: Schema.optionalWith(Timestamp, { as: 'Option', nullable: true }),
})
export type GrillQuestion = typeof GrillQuestion.Type

export const OpenGrillPayload = Schema.Struct({
  review_id: ReviewId,
  work_id: WorkId,
  workspace_id: WorkspaceId,
})
export type OpenGrillPayload = typeof OpenGrillPayload.Type

export const AddGrillQuestionPayload = Schema.Struct({
  prompt: Schema.NonEmptyString,
  severity: QuestionSeverity,
})
export type AddGrillQuestionPayload = typeof AddGrillQuestionPayload.Type

export const GrillEvaluation = Schema.Struct({
  grill: Grill,
  outcome: Schema.Literal('pass', 'fail', 'incomplete'),
  blocking: Schema.Array(Schema.String),
})
export type GrillEvaluation = typeof GrillEvaluation.Type
