/** @Acp.Infra.Http.Api.Reviews — typed review collaboration REST contract */
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform'
import { Schema } from 'effect'
import {
  AddGrillQuestionPayload,
  AddReviewCommentPayload,
  AnswerGrillQuestionPayload,
  Grill,
  GrillDetail,
  GrillEvaluation,
  GrillId,
  GrillQuestion,
  GrillQuestionId,
  OpenGrillPayload,
  ProtocolError,
  RequestReviewPayload,
  Review,
  ReviewApprovalSignature,
  ReviewComment,
  ReviewCommentId,
  ReviewId,
  SetGrillVerdictPayload,
  WorkId,
} from '../../protocol/schema/index.js'

export const ReviewPath = Schema.Struct({
  review_id: HttpApiSchema.param('review_id', ReviewId),
})
export type ReviewPath = typeof ReviewPath.Type

export const ReviewCommentPath = Schema.Struct({
  comment_id: HttpApiSchema.param('comment_id', ReviewCommentId),
})
export type ReviewCommentPath = typeof ReviewCommentPath.Type

export const WorkReviewCommentsPath = Schema.Struct({
  work_id: HttpApiSchema.param('work_id', WorkId),
})
export type WorkReviewCommentsPath = typeof WorkReviewCommentsPath.Type

export const GrillPath = Schema.Struct({
  grill_id: HttpApiSchema.param('grill_id', GrillId),
})
export type GrillPath = typeof GrillPath.Type

export const GrillQuestionPath = Schema.Struct({
  question_id: HttpApiSchema.param('question_id', GrillQuestionId),
})
export type GrillQuestionPath = typeof GrillQuestionPath.Type

export const ApproveReviewPayload = Schema.Struct({
  met_requirements: Schema.Array(Schema.String),
  approval_signature: Schema.optional(ReviewApprovalSignature),
})
export type ApproveReviewPayload = typeof ApproveReviewPayload.Type

export const SetReviewCommentExternalIdPayload = Schema.Struct({
  external_id: Schema.NonEmptyString,
})
export type SetReviewCommentExternalIdPayload =
  typeof SetReviewCommentExternalIdPayload.Type

const protocolError = (status: number) =>
  ({ status }) satisfies { readonly status: number }

export const ReviewGroup = HttpApiGroup.make('reviews')
  .add(
    HttpApiEndpoint.post('requestReview', '/v1/reviews')
      .setPayload(RequestReviewPayload)
      .addSuccess(Review, { status: 201 })
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(404)),
  )
  .add(
    HttpApiEndpoint.post('approveReview', '/v1/reviews/:review_id/approve')
      .setPath(ReviewPath)
      .setPayload(ApproveReviewPayload)
      .addSuccess(Review)
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(404))
      .addError(ProtocolError, protocolError(409)),
  )
  .add(
    HttpApiEndpoint.post('rejectReview', '/v1/reviews/:review_id/reject')
      .setPath(ReviewPath)
      .addSuccess(Review)
      .addError(ProtocolError, protocolError(404))
      .addError(ProtocolError, protocolError(409)),
  )
  .add(
    HttpApiEndpoint.post(
      'requestReviewChanges',
      '/v1/reviews/:review_id/request_changes',
    )
      .setPath(ReviewPath)
      .addSuccess(Review)
      .addError(ProtocolError, protocolError(404))
      .addError(ProtocolError, protocolError(409)),
  )
  .add(
    HttpApiEndpoint.post('cancelReview', '/v1/reviews/:review_id/cancel')
      .setPath(ReviewPath)
      .addSuccess(Review)
      .addError(ProtocolError, protocolError(404))
      .addError(ProtocolError, protocolError(409)),
  )

export const ReviewCommentGroup = HttpApiGroup.make('reviewComments')
  .add(
    HttpApiEndpoint.post('addReviewComment', '/v1/reviews/:review_id/comments')
      .setPath(ReviewPath)
      .setPayload(AddReviewCommentPayload)
      .addSuccess(ReviewComment, { status: 201 })
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(404)),
  )
  .add(
    HttpApiEndpoint.get('listReviewComments', '/v1/reviews/:review_id/comments')
      .setPath(ReviewPath)
      .addSuccess(Schema.Array(ReviewComment))
      .addError(ProtocolError, protocolError(404)),
  )
  .add(
    HttpApiEndpoint.post(
      'resolveReviewComment',
      '/v1/review-comments/:comment_id/resolve',
    )
      .setPath(ReviewCommentPath)
      .addSuccess(ReviewComment)
      .addError(ProtocolError, protocolError(404))
      .addError(ProtocolError, protocolError(409)),
  )
  .add(
    HttpApiEndpoint.post(
      'reopenReviewComment',
      '/v1/review-comments/:comment_id/reopen',
    )
      .setPath(ReviewCommentPath)
      .addSuccess(ReviewComment)
      .addError(ProtocolError, protocolError(404))
      .addError(ProtocolError, protocolError(409)),
  )
  .add(
    HttpApiEndpoint.post(
      'setReviewCommentExternalId',
      '/v1/review-comments/:comment_id/external-id',
    )
      .setPath(ReviewCommentPath)
      .setPayload(SetReviewCommentExternalIdPayload)
      .addSuccess(ReviewComment)
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(404)),
  )
  .add(
    HttpApiEndpoint.get(
      'listWorkReviewComments',
      '/v1/work/:work_id/review-comments',
    )
      .setPath(WorkReviewCommentsPath)
      .addSuccess(Schema.Array(ReviewComment))
      .addError(ProtocolError, protocolError(404)),
  )

export const GrillGroup = HttpApiGroup.make('grills')
  .add(
    HttpApiEndpoint.post('openGrill', '/v1/reviews/:review_id/grill')
      .setPath(ReviewPath)
      .setPayload(OpenGrillPayload)
      .addSuccess(Grill, { status: 201 })
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(404))
      .addError(ProtocolError, protocolError(409)),
  )
  .add(
    HttpApiEndpoint.get('listReviewGrills', '/v1/reviews/:review_id/grills')
      .setPath(ReviewPath)
      .addSuccess(Schema.Array(Grill))
      .addError(ProtocolError, protocolError(404)),
  )
  .add(
    HttpApiEndpoint.post('addGrillQuestion', '/v1/grills/:grill_id/questions')
      .setPath(GrillPath)
      .setPayload(AddGrillQuestionPayload)
      .addSuccess(GrillQuestion, { status: 201 })
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(404))
      .addError(ProtocolError, protocolError(409)),
  )
  .add(
    HttpApiEndpoint.post('evaluateGrill', '/v1/grills/:grill_id/evaluate')
      .setPath(GrillPath)
      .addSuccess(GrillEvaluation)
      .addError(ProtocolError, protocolError(404))
      .addError(ProtocolError, protocolError(409)),
  )
  .add(
    HttpApiEndpoint.get('getGrill', '/v1/grills/:grill_id')
      .setPath(GrillPath)
      .addSuccess(GrillDetail)
      .addError(ProtocolError, protocolError(404)),
  )
  .add(
    HttpApiEndpoint.post(
      'answerGrillQuestion',
      '/v1/grill-questions/:question_id/answer',
    )
      .setPath(GrillQuestionPath)
      .setPayload(AnswerGrillQuestionPayload)
      .addSuccess(GrillQuestion)
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(404))
      .addError(ProtocolError, protocolError(409)),
  )
  .add(
    HttpApiEndpoint.post(
      'setGrillVerdict',
      '/v1/grill-questions/:question_id/verdict',
    )
      .setPath(GrillQuestionPath)
      .setPayload(SetGrillVerdictPayload)
      .addSuccess(GrillQuestion)
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(404))
      .addError(ProtocolError, protocolError(409)),
  )
