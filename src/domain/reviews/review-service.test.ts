/** @Acp.Domain.Reviews.Service.Test — human-in-the-loop review gate */
import { describe, expect, it } from 'vitest'
import { Chunk, Effect, Layer, Option, Schema } from 'effect'
import {
  EventStore,
  EventStoreLive,
  InProcessEventBrokerLive,
} from '../events/index.js'
import { InMemoryStorageLive } from '../../infrastructure/storage/index.js'
import { WorkUnitService, WorkUnitServiceLive } from '../work-units/index.js'
import {
  CreateWorkPayload,
  RequestReviewPayload,
  ReviewId,
  Timestamp,
  WorkerId,
  WorkspaceId,
  WorkId,
} from '../../protocol/schema/index.js'
import { ReviewService, ReviewServiceLive } from './index.js'
import type { CreateWorkInput } from '../work-units/index.js'
import type { Event } from '../../protocol/schema/index.js'

const StorageAndEventsLive = Layer.provideMerge(
  EventStoreLive,
  Layer.merge(InMemoryStorageLive, InProcessEventBrokerLive),
)
const WorkLive = Layer.provideMerge(WorkUnitServiceLive, StorageAndEventsLive)
const TestLive = Layer.provideMerge(ReviewServiceLive, WorkLive)

const runSync = <A, E>(
  program: Effect.Effect<A, E, ReviewService | WorkUnitService | EventStore>,
): A => Effect.runSync(Effect.provide(program, TestLive))

const reviewId = Schema.decodeUnknownSync(ReviewId)('review_main')
const workerId = Schema.decodeUnknownSync(WorkerId)('agent_codex')
const reviewerId = Schema.decodeUnknownSync(WorkerId)('human_chris')
const workId = Schema.decodeUnknownSync(WorkId)('work_review')
const otherWorkId = Schema.decodeUnknownSync(WorkId)('work_review_other')
const workspaceId = Schema.decodeUnknownSync(WorkspaceId)('workspace_review')
const now = Schema.decodeUnknownSync(Timestamp)('2026-06-26T06:00:00.000Z')
const later = Schema.decodeUnknownSync(Timestamp)('2026-06-26T06:05:00.000Z')

const workPayload = Schema.decodeUnknownSync(CreateWorkPayload)({
  workspace_id: 'workspace_review',
  title: 'Review lifecycle',
})

const reviewPayload = Schema.decodeUnknownSync(RequestReviewPayload)({
  work_id: workId,
  requested_by: workerId,
  reviewer: reviewerId,
  requirements: ['diff_review', 'tests_pass'],
})

const createWorkInput = (id = workId): CreateWorkInput => ({
  id,
  payload: workPayload,
  createdBy: workerId,
  now,
})

const prepareWorkForReview = (id = workId) =>
  Effect.gen(function* () {
    const work = yield* WorkUnitService
    yield* work.create(createWorkInput(id))
    yield* work.claim(id, workerId, now)
    yield* work.transition(id, 'running', workerId, now)
  })

const requestReviewInput = (id = reviewId, payload = reviewPayload) => ({
  id,
  payload,
  now: later,
})

describe('ReviewService', () => {
  it('requests review, persists it, emits review.requested, and moves work to needs_review', () => {
    const result = runSync(
      Effect.gen(function* () {
        yield* prepareWorkForReview()
        const reviews = yield* ReviewService
        const work = yield* WorkUnitService
        const events = yield* EventStore
        const requested = yield* reviews.request(requestReviewInput())
        const stored = yield* reviews.get(reviewId)
        const reviewedWork = yield* work.get(workId)
        const log = yield* events.readAfter('workspace_review', 0)
        return { requested, stored, reviewedWork, log }
      }),
    )

    expect(result.requested.state).toBe('requested')
    expect(Option.getOrNull(result.stored)).toEqual(result.requested)
    expect(Option.getOrNull(result.reviewedWork)?.state).toBe('needs_review')
    expect(
      Chunk.toReadonlyArray(result.log).map((event: Event) => event.type),
    ).toEqual([
      'work.created',
      'work.claimed',
      'work.started',
      'review.requested',
      'work.needs_review',
    ])
  })

  it('approves review only when all requirements are met', () => {
    const result = runSync(
      Effect.gen(function* () {
        yield* prepareWorkForReview()
        const reviews = yield* ReviewService
        const work = yield* WorkUnitService
        const events = yield* EventStore
        yield* reviews.request(requestReviewInput())
        const approved = yield* reviews.approve(reviewId, reviewerId, later, [
          'diff_review',
          'tests_pass',
        ])
        const reviewedWork = yield* work.get(workId)
        const log = yield* events.readAfter('workspace_review', 0)
        return { approved, reviewedWork, log }
      }),
    )

    expect(result.approved.state).toBe('approved')
    expect(Option.getOrNull(result.reviewedWork)?.state).toBe('approved')
    expect(
      Chunk.toReadonlyArray(result.log).map((event: Event) => event.type),
    ).toEqual([
      'work.created',
      'work.claimed',
      'work.started',
      'review.requested',
      'work.needs_review',
      'review.approved',
    ])
  })

  it('rejects approval with unmet requirements', () => {
    const error = runSync(
      Effect.either(
        Effect.gen(function* () {
          yield* prepareWorkForReview()
          const reviews = yield* ReviewService
          yield* reviews.request(requestReviewInput())
          return yield* reviews.approve(reviewId, reviewerId, later, [
            'diff_review',
          ])
        }),
      ),
    )

    expect(error._tag).toBe('Left')
    if (error._tag === 'Left') {
      expect(error.left._tag).toBe('ValidationError')
    }
  })

  it('requests changes and moves work to changes_requested', () => {
    const result = runSync(
      Effect.gen(function* () {
        yield* prepareWorkForReview()
        const reviews = yield* ReviewService
        const work = yield* WorkUnitService
        const events = yield* EventStore
        yield* reviews.request(requestReviewInput())
        const review = yield* reviews.requestChanges(
          reviewId,
          reviewerId,
          later,
        )
        const reviewedWork = yield* work.get(workId)
        const log = yield* events.readAfter('workspace_review', 0)
        return { review, reviewedWork, log }
      }),
    )

    expect(result.review.state).toBe('changes_requested')
    expect(Option.getOrNull(result.reviewedWork)?.state).toBe(
      'changes_requested',
    )
    expect(
      Chunk.toReadonlyArray(result.log).map((event: Event) => event.type),
    ).toEqual([
      'work.created',
      'work.claimed',
      'work.started',
      'review.requested',
      'work.needs_review',
      'review.changes_requested',
    ])
  })

  it('cancels a requested review, emits review.cancelled, and resumes work', () => {
    const result = runSync(
      Effect.gen(function* () {
        yield* prepareWorkForReview()
        const reviews = yield* ReviewService
        const work = yield* WorkUnitService
        const events = yield* EventStore
        yield* reviews.request(requestReviewInput())
        const review = yield* reviews.cancel(reviewId, reviewerId, later)
        const reviewedWork = yield* work.get(workId)
        const log = yield* events.readAfter('workspace_review', 0)
        return { review, reviewedWork, log }
      }),
    )

    expect(result.review.state).toBe('cancelled')
    expect(Option.getOrNull(result.reviewedWork)?.state).toBe('running')
    expect(
      Chunk.toReadonlyArray(result.log).map((event: Event) => event.type),
    ).toEqual([
      'work.created',
      'work.claimed',
      'work.started',
      'review.requested',
      'work.needs_review',
      'review.cancelled',
      'work.unblocked',
    ])
  })

  it('lists reviews by work and workspace', () => {
    const result = runSync(
      Effect.gen(function* () {
        yield* prepareWorkForReview()
        yield* prepareWorkForReview(otherWorkId)
        const reviews = yield* ReviewService
        yield* reviews.request(requestReviewInput())
        yield* reviews.request(
          requestReviewInput(
            Schema.decodeUnknownSync(ReviewId)('review_other'),
            Schema.decodeUnknownSync(RequestReviewPayload)({
              work_id: otherWorkId,
              requested_by: workerId,
              requirements: [],
            }),
          ),
        )
        const forWork = yield* reviews.listForWork(workId)
        const forWorkspace = yield* reviews.listForWorkspace(workspaceId)
        return { forWork, forWorkspace }
      }),
    )

    expect(result.forWork.map((review) => review.id)).toEqual([reviewId])
    expect(result.forWorkspace.map((review) => review.id).sort()).toEqual([
      reviewId,
      'review_other',
    ])
  })

  it('returns NotFoundError for missing review', () => {
    const error = runSync(
      Effect.either(
        Effect.gen(function* () {
          const reviews = yield* ReviewService
          return yield* reviews.reject(
            Schema.decodeUnknownSync(ReviewId)('review_missing'),
            reviewerId,
            later,
          )
        }),
      ),
    )

    expect(error._tag).toBe('Left')
    if (error._tag === 'Left') {
      expect(error.left._tag).toBe('NotFoundError')
    }
  })
})
