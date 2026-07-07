/** @Acp.App.Server.ReviewRoutes — review lifecycle mutation handlers */
import { HttpServerRequest } from '@effect/platform'
import { Effect, Option } from 'effect'
import { ReviewService } from '../../domain/reviews/index.js'
import { ApproveReviewPayload } from '../../infrastructure/http/index.js'
import { RequestReviewPayload, Review } from '../../protocol/schema/index.js'
import type { ReviewId } from '../../protocol/schema/index.js'
import { IdClock } from './identity.js'
import * as target from './resource-workspace-auth.js'
import { ok, pathParam, respond } from './route-support.js'

export const requestReview = respond('POST /v1/reviews')(
  Effect.gen(function* () {
    const service = yield* ReviewService
    const idClock = yield* IdClock
    const payload =
      yield* HttpServerRequest.schemaBodyJson(RequestReviewPayload)
    const id = (yield* idClock.nextId('review')) as ReviewId
    const now = yield* idClock.now
    yield* target.reviewRequest('review:create', payload.work_id)
    const review = yield* service.request({ id, payload, now })
    return yield* ok(201)(Review, review)
  }),
)

export const approveReview = respond('POST /v1/reviews/:review_id/approve')(
  Effect.gen(function* () {
    const service = yield* ReviewService
    const idClock = yield* IdClock
    const reviewId = (yield* pathParam('review_id')) as ReviewId
    const payload =
      yield* HttpServerRequest.schemaBodyJson(ApproveReviewPayload)
    const now = yield* idClock.now
    const { actor } = yield* target.review('review:approve', reviewId)
    const review = yield* service.approve(
      reviewId,
      actor,
      now,
      payload.met_requirements,
      Option.fromNullable(payload.approval_signature),
    )
    return yield* ok(200)(Review, review)
  }),
)

export const rejectReview = respond('POST /v1/reviews/:review_id/reject')(
  Effect.gen(function* () {
    const service = yield* ReviewService
    const idClock = yield* IdClock
    const reviewId = (yield* pathParam('review_id')) as ReviewId
    const now = yield* idClock.now
    const { actor } = yield* target.review('review:reject', reviewId)
    const review = yield* service.reject(reviewId, actor, now)
    return yield* ok(200)(Review, review)
  }),
)

export const requestReviewChanges = respond(
  'POST /v1/reviews/:review_id/request_changes',
)(
  Effect.gen(function* () {
    const service = yield* ReviewService
    const idClock = yield* IdClock
    const reviewId = (yield* pathParam('review_id')) as ReviewId
    const now = yield* idClock.now
    const { actor } = yield* target.review('review:request_changes', reviewId)
    const review = yield* service.requestChanges(reviewId, actor, now)
    return yield* ok(200)(Review, review)
  }),
)

export const cancelReview = respond('POST /v1/reviews/:review_id/cancel')(
  Effect.gen(function* () {
    const service = yield* ReviewService
    const idClock = yield* IdClock
    const reviewId = (yield* pathParam('review_id')) as ReviewId
    const now = yield* idClock.now
    const { actor } = yield* target.review('review:cancel', reviewId)
    const review = yield* service.cancel(reviewId, actor, now)
    return yield* ok(200)(Review, review)
  }),
)
