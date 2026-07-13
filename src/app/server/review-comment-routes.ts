/** @Acp.App.Server.ReviewCommentRoutes — diff-anchored review comment handlers */
import { HttpServerRequest } from '@effect/platform'
import { Effect, Schema } from 'effect'
import { ReviewCommentService } from '../../domain/review-comments/index.js'
import {
  AddReviewCommentPayload,
  ReviewComment,
} from '../../protocol/schema/index.js'
import type {
  ReviewCommentId,
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

const workIdParam = () => Effect.map(pathParam('work_id'), (v) => v as WorkId)

const commentIdParam = () =>
  Effect.map(pathParam('comment_id'), (v) => v as ReviewCommentId)

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

export const addReviewComment = respond('POST /v1/reviews/:review_id/comments')(
  Effect.gen(function* () {
    const service = yield* ReviewCommentService
    const reviewId = yield* reviewIdParam()
    const { actor, review, work } = yield* collaboration.reviewTarget(
      'review:collaborate',
      reviewId,
    )
    const payload = yield* HttpServerRequest.schemaBodyJson(
      AddReviewCommentPayload,
    )
    yield* validateTargetIdentity(
      payload,
      review.id,
      work.id,
      work.workspace_id,
    )
    const idClock = yield* IdClock
    const id = (yield* idClock.nextId('reviewcomment')) as ReviewCommentId
    const now = yield* idClock.now
    const created = yield* service.add({ id, payload, author: actor, now })
    return yield* ok(201)(ReviewComment, created)
  }),
)

export const resolveReviewComment = respond(
  'POST /v1/review-comments/:comment_id/resolve',
)(
  Effect.gen(function* () {
    const service = yield* ReviewCommentService
    const idClock = yield* IdClock
    const commentId = yield* commentIdParam()
    const { actor } = yield* collaboration.reviewCommentTarget(
      'review:collaborate',
      commentId,
    )
    const now = yield* idClock.now
    const updated = yield* service.resolve(commentId, actor, now)
    return yield* ok(200)(ReviewComment, updated)
  }),
)

export const reopenReviewComment = respond(
  'POST /v1/review-comments/:comment_id/reopen',
)(
  Effect.gen(function* () {
    const service = yield* ReviewCommentService
    const idClock = yield* IdClock
    const commentId = yield* commentIdParam()
    const { actor } = yield* collaboration.reviewCommentTarget(
      'review:collaborate',
      commentId,
    )
    const now = yield* idClock.now
    const updated = yield* service.reopen(commentId, actor, now)
    return yield* ok(200)(ReviewComment, updated)
  }),
)

export const setReviewCommentExternalId = respond(
  'POST /v1/review-comments/:comment_id/external-id',
)(
  Effect.gen(function* () {
    const service = yield* ReviewCommentService
    const idClock = yield* IdClock
    const commentId = yield* commentIdParam()
    yield* collaboration.reviewCommentTarget('review:collaborate', commentId)
    const body = yield* HttpServerRequest.schemaBodyJson(
      Schema.Struct({ external_id: Schema.NonEmptyString }),
    )
    const now = yield* idClock.now
    const updated = yield* service.setExternalId(
      commentId,
      body.external_id,
      now,
    )
    return yield* ok(200)(ReviewComment, updated)
  }),
)

export const listReviewComments = respond(
  'GET /v1/reviews/:review_id/comments',
)(
  Effect.gen(function* () {
    const service = yield* ReviewCommentService
    const reviewId = yield* reviewIdParam()
    yield* target.review('workspace:read', reviewId)
    const found = yield* service.listForReview(reviewId)
    return yield* ok(200)(Schema.Array(ReviewComment), found)
  }),
)

export const listWorkReviewComments = respond(
  'GET /v1/work/:work_id/review-comments',
)(
  Effect.gen(function* () {
    const service = yield* ReviewCommentService
    const workId = yield* workIdParam()
    yield* target.work('workspace:read', workId)
    const found = yield* service.listForWork(workId)
    return yield* ok(200)(Schema.Array(ReviewComment), found)
  }),
)
