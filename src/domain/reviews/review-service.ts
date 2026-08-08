/** @Acp.Domain.Reviews.Service — human-in-the-loop review gate */
import { Chunk, Context, Effect, Layer, Option, Schema } from 'effect'
import { EventStore } from '../events/index.js'
import { HookDispatcher } from '../hooks/index.js'
import { WorkerIdentityService } from '../identity/index.js'
import { WorkUnitService } from '../work-units/index.js'
import { Storage } from '../../infrastructure/storage/index.js'
import type {
  BudgetExhaustedError,
  ForbiddenError,
  HookDeniedError,
  IncompleteChildrenError,
} from '../../protocol/errors/protocol-error.js'
import {
  InvalidStateTransitionError,
  NotFoundError,
  StorageError,
  ValidationError,
} from '../../protocol/errors/protocol-error.js'
import { Event, Review } from '../../protocol/schema/index.js'
import type {
  EventType,
  RequestReviewPayload,
  ReviewId,
  WorkerAssertionPayload,
  ReviewApprovalSignature,
  ReviewState,
  Timestamp,
  WorkerId,
  WorkId,
  WorkspaceId,
} from '../../protocol/schema/index.js'

export interface RequestReviewInput {
  readonly id: ReviewId
  readonly payload: RequestReviewPayload
  readonly now: Timestamp
}

/**
 * Errors a review verdict can surface. `IncompleteChildrenError` reaches here
 * because a verdict drives the underlying work unit's state machine, which is
 * gated by the spawn graph — see [[ADR-0021-work-unit-spawn-graph]].
 */
export type ReviewVerdictError =
  | NotFoundError
  | InvalidStateTransitionError
  | IncompleteChildrenError
  | HookDeniedError
  | ForbiddenError
  | BudgetExhaustedError
  | StorageError

export type ReviewServiceError = ValidationError | ReviewVerdictError

export interface ReviewServiceApi {
  readonly request: (
    input: RequestReviewInput,
  ) => Effect.Effect<Review, ReviewVerdictError>
  readonly get: (
    reviewId: ReviewId,
  ) => Effect.Effect<Option.Option<Review>, StorageError>
  readonly listForWork: (
    workId: WorkId,
  ) => Effect.Effect<readonly Review[], StorageError>
  readonly listForWorkspace: (
    workspaceId: WorkspaceId,
  ) => Effect.Effect<readonly Review[], NotFoundError | StorageError>
  readonly approve: (
    reviewId: ReviewId,
    actor: WorkerId,
    now: Timestamp,
    metRequirements: readonly string[],
    approvalSignature?: Option.Option<ReviewApprovalSignature>,
    /** Provenance for the verdict; required when signatures are enforced. */
    assertion?: WorkerAssertionPayload,
  ) => Effect.Effect<Review, ReviewServiceError>
  readonly reject: (
    reviewId: ReviewId,
    actor: WorkerId,
    now: Timestamp,
    assertion?: WorkerAssertionPayload,
  ) => Effect.Effect<Review, ReviewVerdictError>
  readonly requestChanges: (
    reviewId: ReviewId,
    actor: WorkerId,
    now: Timestamp,
    assertion?: WorkerAssertionPayload,
  ) => Effect.Effect<Review, ReviewVerdictError>
  readonly cancel: (
    reviewId: ReviewId,
    actor: WorkerId,
    now: Timestamp,
    /**
     * Cancelling is a review state change like any other, so it must be able
     * to prove itself. Without this parameter, enforcement made cancel
     * impossible: `transitionReview` demanded a signature the caller had no
     * way to supply.
     */
    assertion?: WorkerAssertionPayload,
  ) => Effect.Effect<Review, ReviewVerdictError>
}

export class ReviewService extends Context.Tag('ReviewService')<
  ReviewService,
  ReviewServiceApi
>() {}

const collection = 'review'

const decodeStoredReview = (value: unknown) =>
  Schema.decodeUnknown(Review)(value).pipe(
    Effect.mapError(
      (error) =>
        new StorageError({
          op: 'decode_review',
          cause: String(error),
        }),
    ),
  )

const reviewEventType = (state: ReviewState): EventType => {
  switch (state) {
    case 'requested':
      return 'review.requested'
    case 'approved':
      return 'review.approved'
    case 'rejected':
      return 'review.rejected'
    case 'changes_requested':
      return 'review.changes_requested'
    case 'cancelled':
      return 'review.cancelled'
  }
}

const make = Effect.gen(function* () {
  const storage = yield* Storage
  const events = yield* EventStore
  const workUnits = yield* WorkUnitService
  const hooks = yield* HookDispatcher
  const identity = yield* WorkerIdentityService

  const encodeReview = (review: Review) =>
    Schema.encode(Review)(review).pipe(
      Effect.mapError(
        (error) =>
          new StorageError({
            op: 'encode_review',
            cause: String(error),
          }),
      ),
    )

  const save = (review: Review) =>
    Effect.flatMap(encodeReview(review), (encoded) =>
      storage.put(collection, review.id, encoded),
    )

  const approvalSignatureEventData = (signature: ReviewApprovalSignature) => ({
    algorithm: signature.algorithm,
    key_id: signature.key_id,
    value: signature.value,
    signed_at: Option.getOrNull(signature.signed_at),
  })

  const reviewEventData = (review: Review) => ({
    review_id: review.id,
    state: review.state,
    requirements: review.requirements,
    ...(Option.isSome(review.approval_signature)
      ? {
          approval_signature: approvalSignatureEventData(
            review.approval_signature.value,
          ),
        }
      : {}),
  })

  const appendReviewEvent = (
    review: Review,
    workspaceId: WorkspaceId,
    actor: WorkerId,
    timestamp: Timestamp,
    type: EventType,
  ) =>
    Effect.flatMap(
      Schema.decodeUnknown(Event)({
        id: `event_${review.id}_${type}_${timestamp}`,
        type,
        workspace_id: workspaceId,
        work_id: review.work_id,
        actor,
        timestamp,
        seq: 0,
        data: reviewEventData(review),
      }).pipe(
        Effect.mapError(
          (error) =>
            new StorageError({
              op: 'decode_review_event',
              cause: String(error),
            }),
        ),
      ),
      (event) =>
        events.append({
          id: event.id,
          type: event.type,
          workspace_id: event.workspace_id,
          work_id: event.work_id,
          actor: event.actor,
          timestamp: event.timestamp,
          data: event.data,
        }),
    )

  const get: ReviewServiceApi['get'] = (reviewId) =>
    Effect.flatMap(storage.get(collection, reviewId), (stored) =>
      Option.match(stored, {
        onNone: () => Effect.succeed(Option.none<Review>()),
        onSome: (value) => Effect.map(decodeStoredReview(value), Option.some),
      }),
    )

  const requireReview = (reviewId: ReviewId) =>
    Effect.flatMap(get(reviewId), (review) =>
      Option.match(review, {
        onNone: () =>
          Effect.fail(new NotFoundError({ entity: 'review', id: reviewId })),
        onSome: Effect.succeed,
      }),
    )

  const requireWork = (workId: WorkId) =>
    Effect.flatMap(workUnits.get(workId), (work) =>
      Option.match(work, {
        onNone: () =>
          Effect.fail(new NotFoundError({ entity: 'work', id: workId })),
        onSome: Effect.succeed,
      }),
    )

  // Reviews carry work_id but not workspace_id — listForWork is an indexed
  // queryBy; listForWorkspace still joins through work (no workspace index).
  const listForWork: ReviewServiceApi['listForWork'] = (workId) =>
    Effect.flatMap(
      storage.queryBy(collection, [{ field: 'work_id', value: workId }]),
      (stored) =>
        Effect.forEach(Chunk.toReadonlyArray(stored), decodeStoredReview),
    )

  const listForWorkspace: ReviewServiceApi['listForWorkspace'] = (
    workspaceId,
  ) =>
    Effect.flatMap(storage.list(collection), (stored) =>
      Effect.flatMap(
        Effect.forEach(Chunk.toReadonlyArray(stored), decodeStoredReview),
        (reviews) =>
          Effect.map(
            Effect.forEach(reviews, (review) =>
              Effect.map(requireWork(review.work_id), (work) => ({
                review,
                work,
              })),
            ),
            (pairs) =>
              pairs
                .filter((pair) => pair.work.workspace_id === workspaceId)
                .map((pair) => pair.review),
          ),
      ),
    )

  const request: ReviewServiceApi['request'] = (input) =>
    Effect.gen(function* () {
      const work = yield* requireWork(input.payload.work_id)
      const review: Review = {
        id: input.id,
        work_id: input.payload.work_id,
        requested_by: input.payload.requested_by,
        reviewer: input.payload.reviewer,
        state: 'requested',
        requirements: input.payload.requirements,
        approval_signature: Option.none(),
        created_at: input.now,
      }

      // Check before writing. The transition is the part that can legitimately
      // refuse — the work may already be in review, or the spawn-graph gate may
      // hold it back for live children — and doing it *after* the write left a
      // dangling review plus a `review.requested` event describing a request
      // that never took effect. Checking first keeps the log's causal order
      // (request, then transition) while making a refusal write nothing.
      yield* workUnits.canTransition(review.work_id, 'needs_review')

      yield* save(review)
      yield* appendReviewEvent(
        review,
        work.workspace_id,
        input.payload.requested_by,
        input.now,
        'review.requested',
      )
      yield* workUnits.transition(
        review.work_id,
        'needs_review',
        input.payload.requested_by,
        input.now,
      )
      return review
    })

  const transitionReview = (
    review: Review,
    actor: WorkerId,
    now: Timestamp,
    to: ReviewState,
    assertion?: WorkerAssertionPayload,
  ) =>
    Effect.gen(function* () {
      // Every verdict funnels through here, so provenance is checked once
      // rather than at three call sites that could drift apart.
      yield* identity.verify({
        workerId: actor,
        action: 'review.verdict',
        targetId: review.id,
        assertion:
          assertion === undefined
            ? Option.none()
            : Option.some({
                workerId: assertion.worker_id,
                action: assertion.action,
                targetId: assertion.target_id,
                timestamp: assertion.timestamp,
                signature: assertion.signature,
              }),
        now,
      })

      if (review.state !== 'requested') {
        return yield* Effect.fail(
          new InvalidStateTransitionError({ from: review.state, to }),
        )
      }

      const work = yield* requireWork(review.work_id)

      yield* hooks.dispatch('review.before_verdict', {
        point: 'review.before_verdict',
        workspaceId: work.workspace_id,
        actor,
        subjectId: review.id,
        detail: { verdict: to, work_id: review.work_id },
      })

      const next: Review = { ...review, state: to }
      yield* save(next)
      yield* appendReviewEvent(
        next,
        work.workspace_id,
        actor,
        now,
        reviewEventType(to),
      )
      return next
    })

  const approve: ReviewServiceApi['approve'] = (
    reviewId,
    actor,
    now,
    metRequirements,
    approvalSignature = Option.none(),
    assertion,
  ) =>
    Effect.flatMap(requireReview(reviewId), (review) =>
      Effect.gen(function* () {
        const unmet = review.requirements.filter(
          (requirement) => !metRequirements.includes(requirement),
        )
        if (unmet.length > 0) {
          return yield* Effect.fail(
            new ValidationError({
              issues: [`unmet review requirements: ${unmet.join(', ')}`],
            }),
          )
        }

        const approved = yield* transitionReview(
          { ...review, approval_signature: approvalSignature },
          actor,
          now,
          'approved',
          assertion,
        )
        yield* workUnits.transitionSilently(
          review.work_id,
          'approved',
          actor,
          now,
        )
        return approved
      }),
    )

  const reject: ReviewServiceApi['reject'] = (
    reviewId,
    actor,
    now,
    assertion,
  ) =>
    Effect.flatMap(requireReview(reviewId), (review) =>
      Effect.gen(function* () {
        const rejected = yield* transitionReview(
          review,
          actor,
          now,
          'rejected',
          assertion,
        )
        yield* workUnits.transitionSilently(
          review.work_id,
          'rejected',
          actor,
          now,
        )
        return rejected
      }),
    )

  const requestChanges: ReviewServiceApi['requestChanges'] = (
    reviewId,
    actor,
    now,
    assertion,
  ) =>
    Effect.flatMap(requireReview(reviewId), (review) =>
      Effect.gen(function* () {
        const next = yield* transitionReview(
          review,
          actor,
          now,
          'changes_requested',
          assertion,
        )
        yield* workUnits.transitionSilently(
          review.work_id,
          'changes_requested',
          actor,
          now,
        )
        return next
      }),
    )

  const cancel: ReviewServiceApi['cancel'] = (
    reviewId,
    actor,
    now,
    assertion,
  ) =>
    Effect.flatMap(requireReview(reviewId), (review) =>
      Effect.gen(function* () {
        const cancelled = yield* transitionReview(
          review,
          actor,
          now,
          'cancelled',
          assertion,
        )
        yield* workUnits.transition(review.work_id, 'running', actor, now)
        return cancelled
      }),
    )

  return {
    request,
    get,
    listForWork,
    listForWorkspace,
    approve,
    reject,
    requestChanges,
    cancel,
  } satisfies ReviewServiceApi
})

export const ReviewServiceLive: Layer.Layer<
  ReviewService,
  never,
  | Storage
  | EventStore
  | WorkUnitService
  | HookDispatcher
  | WorkerIdentityService
> = Layer.effect(ReviewService, make)
