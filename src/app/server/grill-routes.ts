/** @Acp.App.Server.GrillRoutes — forced senior-question review gate handlers */
import { HttpServerRequest } from '@effect/platform'
import { Effect, Schema } from 'effect'
import { GrillService } from '../../domain/grills/index.js'
import {
  AddGrillQuestionPayload,
  AnswerGrillQuestionPayload,
  Grill,
  GrillDetail,
  GrillEvaluation,
  GrillQuestion,
  OpenGrillPayload,
  SetGrillVerdictPayload,
} from '../../protocol/schema/index.js'
import type {
  GrillId,
  GrillQuestionId,
  ReviewId,
  WorkId,
  WorkspaceId,
} from '../../protocol/schema/index.js'
import { ValidationError } from '../../protocol/errors/protocol-error.js'
import { IdClock } from './identity.js'
import * as target from './resource-workspace-auth.js'
import * as collaboration from './review-collaboration-auth.js'
import { ok, pathParam, respond } from './route-support.js'

const reviewIdParam = () =>
  Effect.map(pathParam('review_id'), (v) => v as ReviewId)

const grillIdParam = () =>
  Effect.map(pathParam('grill_id'), (v) => v as GrillId)

const questionIdParam = () =>
  Effect.map(pathParam('question_id'), (v) => v as GrillQuestionId)

const validateTargetIdentity = (
  payload: {
    readonly review_id: ReviewId
    readonly work_id: WorkId
    readonly workspace_id: WorkspaceId
  },
  reviewId: ReviewId,
  workId: WorkId,
  workspaceId: WorkspaceId,
) => {
  const issues = [
    ...(payload.review_id === reviewId
      ? []
      : ['review_id must match the target review']),
    ...(payload.work_id === workId
      ? []
      : ['work_id must match the target review work']),
    ...(payload.workspace_id === workspaceId
      ? []
      : ['workspace_id must match the target review workspace']),
  ]
  return issues.length === 0
    ? Effect.void
    : Effect.fail(new ValidationError({ issues }))
}

export const openGrill = respond('POST /v1/reviews/:review_id/grill')(
  Effect.gen(function* () {
    const service = yield* GrillService
    const reviewId = yield* reviewIdParam()
    const { actor, review, work } = yield* collaboration.reviewTarget(
      'review:collaborate',
      reviewId,
    )
    const payload = yield* HttpServerRequest.schemaBodyJson(OpenGrillPayload)
    yield* validateTargetIdentity(
      payload,
      review.id,
      work.id,
      work.workspace_id,
    )
    const idClock = yield* IdClock
    const id = (yield* idClock.nextId('grill')) as GrillId
    const now = yield* idClock.now
    const grill = yield* service.open({ id, payload, openedBy: actor, now })
    return yield* ok(201)(Grill, grill)
  }),
)

export const addGrillQuestion = respond('POST /v1/grills/:grill_id/questions')(
  Effect.gen(function* () {
    const service = yield* GrillService
    const grillId = yield* grillIdParam()
    const { actor } = yield* collaboration.grillTarget(
      'review:collaborate',
      grillId,
    )
    const payload = yield* HttpServerRequest.schemaBodyJson(
      AddGrillQuestionPayload,
    )
    const idClock = yield* IdClock
    const id = (yield* idClock.nextId('grillquestion')) as GrillQuestionId
    const now = yield* idClock.now
    const question = yield* service.addQuestion(grillId, {
      id,
      payload,
      actor,
      now,
    })
    return yield* ok(201)(GrillQuestion, question)
  }),
)

export const answerGrillQuestion = respond(
  'POST /v1/grill-questions/:question_id/answer',
)(
  Effect.gen(function* () {
    const service = yield* GrillService
    const questionId = yield* questionIdParam()
    const { actor } = yield* collaboration.grillQuestionTarget(
      'review:respond',
      questionId,
    )
    const payload = yield* HttpServerRequest.schemaBodyJson(
      AnswerGrillQuestionPayload,
    )
    const idClock = yield* IdClock
    const now = yield* idClock.now
    const answered = yield* service.answer(questionId, {
      answer: payload.answer,
      answeredBy: actor,
      now,
    })
    return yield* ok(200)(GrillQuestion, answered)
  }),
)

export const setGrillVerdict = respond(
  'POST /v1/grill-questions/:question_id/verdict',
)(
  Effect.gen(function* () {
    const service = yield* GrillService
    const questionId = yield* questionIdParam()
    const { actor } = yield* collaboration.grillQuestionTarget(
      'review:collaborate',
      questionId,
    )
    const payload = yield* HttpServerRequest.schemaBodyJson(
      SetGrillVerdictPayload,
    )
    const idClock = yield* IdClock
    const now = yield* idClock.now
    const decided = yield* service.setVerdict(
      questionId,
      payload.verdict,
      actor,
      now,
    )
    return yield* ok(200)(GrillQuestion, decided)
  }),
)

export const evaluateGrill = respond('POST /v1/grills/:grill_id/evaluate')(
  Effect.gen(function* () {
    const service = yield* GrillService
    const idClock = yield* IdClock
    const grillId = yield* grillIdParam()
    yield* collaboration.grillTarget('review:collaborate', grillId)
    const now = yield* idClock.now
    const evaluation = yield* service.evaluate(grillId, now)
    return yield* ok(200)(GrillEvaluation, evaluation)
  }),
)

export const getGrill = respond('GET /v1/grills/:grill_id')(
  Effect.gen(function* () {
    const grillId = yield* grillIdParam()
    const { grill, questions } = yield* target.grill('workspace:read', grillId)
    return yield* ok(200)(GrillDetail, { grill, questions })
  }),
)

export const listReviewGrills = respond('GET /v1/reviews/:review_id/grills')(
  Effect.gen(function* () {
    const service = yield* GrillService
    const reviewId = yield* reviewIdParam()
    yield* target.review('workspace:read', reviewId)
    const found = yield* service.listForReview(reviewId)
    return yield* ok(200)(Schema.Array(Grill), found)
  }),
)
