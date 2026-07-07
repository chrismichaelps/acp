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
} from '../../protocol/schema/index.js'
import { IdClock } from './identity.js'
import * as target from './resource-workspace-auth.js'
import { authorizeWorkspace, ok, pathParam, respond } from './route-support.js'

const reviewIdParam = () =>
  Effect.map(pathParam('review_id'), (v) => v as ReviewId)

const grillIdParam = () =>
  Effect.map(pathParam('grill_id'), (v) => v as GrillId)

const questionIdParam = () =>
  Effect.map(pathParam('question_id'), (v) => v as GrillQuestionId)

export const openGrill = respond('POST /v1/reviews/:review_id/grill')(
  Effect.gen(function* () {
    const service = yield* GrillService
    const idClock = yield* IdClock
    const payload = yield* HttpServerRequest.schemaBodyJson(OpenGrillPayload)
    const id = (yield* idClock.nextId('grill')) as GrillId
    const now = yield* idClock.now
    const openedBy = yield* authorizeWorkspace(
      'workspace:write',
      payload.workspace_id,
    )
    const grill = yield* service.open({ id, payload, openedBy, now })
    return yield* ok(201)(Grill, grill)
  }),
)

export const addGrillQuestion = respond('POST /v1/grills/:grill_id/questions')(
  Effect.gen(function* () {
    const service = yield* GrillService
    const idClock = yield* IdClock
    const grillId = yield* grillIdParam()
    const payload = yield* HttpServerRequest.schemaBodyJson(
      AddGrillQuestionPayload,
    )
    const id = (yield* idClock.nextId('grillquestion')) as GrillQuestionId
    const now = yield* idClock.now
    const { actor } = yield* target.grill('workspace:write', grillId)
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
    const idClock = yield* IdClock
    const questionId = yield* questionIdParam()
    const payload = yield* HttpServerRequest.schemaBodyJson(
      AnswerGrillQuestionPayload,
    )
    const now = yield* idClock.now
    const { actor } = yield* target.grillQuestion('workspace:write', questionId)
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
    const idClock = yield* IdClock
    const questionId = yield* questionIdParam()
    const payload = yield* HttpServerRequest.schemaBodyJson(
      SetGrillVerdictPayload,
    )
    const now = yield* idClock.now
    const { actor } = yield* target.grillQuestion('workspace:write', questionId)
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
    const now = yield* idClock.now
    yield* target.grill('workspace:write', grillId)
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
