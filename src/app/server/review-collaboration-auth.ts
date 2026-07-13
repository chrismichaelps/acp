/** @Acp.App.Server.ReviewCollaborationAuth — opaque review target authorization */
import { Effect, Option } from 'effect'
import { GrillService } from '../../domain/grills/index.js'
import { ReviewCommentService } from '../../domain/review-comments/index.js'
import { ReviewService } from '../../domain/reviews/index.js'
import { WorkUnitService } from '../../domain/work-units/index.js'
import { NotFoundError } from '../../protocol/errors/protocol-error.js'
import type {
  GrillId,
  GrillQuestionId,
  Permission,
  ReviewCommentId,
  ReviewId,
  Session,
  WorkspaceId,
} from '../../protocol/schema/index.js'
import { authorizeActor } from './route-support.js'

type CollaborationScope = Extract<
  Permission,
  'review:collaborate' | 'review:respond'
>

const fromOption =
  <A>(entity: string, id: string) =>
  (value: Option.Option<A>) =>
    Option.match(value, {
      onNone: () => Effect.fail(new NotFoundError({ entity, id })),
      onSome: Effect.succeed,
    })

const requireVisibleTarget = (
  workspaceIds: Session['workspace_ids'],
  workspaceId: WorkspaceId,
  entity: string,
  id: string,
) =>
  Option.match(workspaceIds, {
    onNone: () => Effect.void,
    onSome: (ids) =>
      ids.includes(workspaceId)
        ? Effect.void
        : Effect.fail(new NotFoundError({ entity, id })),
  })

export const reviewTarget = (scope: CollaborationScope, reviewId: ReviewId) =>
  Effect.gen(function* () {
    const actor = yield* authorizeActor(scope)
    const reviews = yield* ReviewService
    const workUnits = yield* WorkUnitService
    const review = yield* Effect.flatMap(
      reviews.get(reviewId),
      fromOption('review', reviewId),
    )
    const work = yield* Effect.flatMap(
      workUnits.get(review.work_id),
      fromOption('work', review.work_id),
    )
    yield* requireVisibleTarget(
      actor.workspace_ids,
      work.workspace_id,
      'review',
      reviewId,
    )
    return { actor: actor.worker_id, review, work }
  })

export const reviewCommentTarget = (
  scope: CollaborationScope,
  commentId: ReviewCommentId,
) =>
  Effect.gen(function* () {
    const actor = yield* authorizeActor(scope)
    const comments = yield* ReviewCommentService
    const comment = yield* Effect.flatMap(
      comments.get(commentId),
      fromOption('review_comment', commentId),
    )
    yield* requireVisibleTarget(
      actor.workspace_ids,
      comment.workspace_id,
      'review_comment',
      commentId,
    )
    return { actor: actor.worker_id, comment }
  })

export const grillTarget = (scope: CollaborationScope, grillId: GrillId) =>
  Effect.gen(function* () {
    const actor = yield* authorizeActor(scope)
    const grills = yield* GrillService
    const found = yield* Effect.flatMap(
      grills.get(grillId),
      fromOption('grill', grillId),
    )
    yield* requireVisibleTarget(
      actor.workspace_ids,
      found.grill.workspace_id,
      'grill',
      grillId,
    )
    return {
      actor: actor.worker_id,
      grill: found.grill,
      questions: found.questions,
    }
  })

export const grillQuestionTarget = (
  scope: CollaborationScope,
  questionId: GrillQuestionId,
) =>
  Effect.gen(function* () {
    const actor = yield* authorizeActor(scope)
    const grills = yield* GrillService
    const question = yield* Effect.flatMap(
      grills.getQuestion(questionId),
      fromOption('grill_question', questionId),
    )
    const found = yield* Effect.flatMap(
      grills.get(question.grill_id),
      fromOption('grill', question.grill_id),
    )
    yield* requireVisibleTarget(
      actor.workspace_ids,
      found.grill.workspace_id,
      'grill_question',
      questionId,
    )
    return { actor: actor.worker_id, question, grill: found.grill }
  })
