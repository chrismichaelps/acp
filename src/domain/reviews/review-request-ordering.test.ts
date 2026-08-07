/** @Acp.Domain.Reviews.RequestOrdering.Test — a refused request must persist nothing */
import { describe, expect, it } from 'vitest'
import { Chunk, Effect, Layer, Schema } from 'effect'
import { TestAppConfigLive } from '../../config/app-config-test-support.js'
import { TestIdentityLive } from '../identity/identity-test-support.js'
import {
  EventStore,
  EventStoreLive,
  InProcessEventBrokerLive,
} from '../events/index.js'
import { NoHooksLive } from '../hooks/index.js'
import { InMemoryStorageLive } from '../../infrastructure/storage/index.js'
import { WorkUnitService, WorkUnitServiceLive } from '../work-units/index.js'
import {
  CreateWorkPayload,
  RequestReviewPayload,
  Timestamp,
  WorkId,
  WorkerId,
  WorkspaceId,
} from '../../protocol/schema/index.js'
import type { ReviewId } from '../../protocol/schema/index.js'
import { ReviewService, ReviewServiceLive } from './index.js'

const workerId = Schema.decodeUnknownSync(WorkerId)('agent_a')
const workspaceId = Schema.decodeUnknownSync(WorkspaceId)('workspace_ro')
const workId = Schema.decodeUnknownSync(WorkId)('work_1')
const now = Schema.decodeUnknownSync(Timestamp)('2026-08-07T10:00:00Z')

const base = Layer.merge(
  Layer.provideMerge(
    EventStoreLive,
    Layer.merge(InMemoryStorageLive, InProcessEventBrokerLive),
  ),
  Layer.mergeAll(TestAppConfigLive(), NoHooksLive, TestIdentityLive),
)
const work = Layer.provideMerge(WorkUnitServiceLive, base)
const TestLive = Layer.provideMerge(ReviewServiceLive, work)

const run = <A, E>(
  program: Effect.Effect<A, E, ReviewService | WorkUnitService | EventStore>,
) => Effect.runSyncExit(Effect.provide(program, TestLive))

const requestReview = (id: string, forWork = 'work_1') =>
  Effect.flatMap(ReviewService, (svc) =>
    svc.request({
      id: id as ReviewId,
      payload: Schema.decodeUnknownSync(RequestReviewPayload)({
        work_id: forWork,
        requested_by: workerId,
        requirements: [],
      }),
      now,
    }),
  )

const readyWork = Effect.gen(function* () {
  const svc = yield* WorkUnitService
  yield* svc.create({
    id: workId,
    payload: Schema.decodeUnknownSync(CreateWorkPayload)({
      workspace_id: workspaceId,
      title: 'T',
    }),
    createdBy: workerId,
    now,
  })
  yield* svc.claim(workId, workerId, now)
  yield* svc.transition(workId, 'running', workerId, now)
})

describe('review request ordering', () => {
  it('requests a review on running work', () => {
    const exit = run(Effect.zipRight(readyWork, requestReview('review_1')))
    expect(exit._tag).toBe('Success')
  })

  // The bug this guards: the review was saved and `review.requested` emitted
  // *before* the work transition was attempted, so a refused request left a
  // dangling review and an event describing a request that never took effect.
  it('persists no review when the work cannot enter review', () => {
    const result = run(
      Effect.gen(function* () {
        const reviews = yield* ReviewService
        yield* readyWork
        yield* requestReview('review_1')
        // Second request: work is already needs_review, so the transition is
        // illegal and the whole request must be refused cleanly.
        const second = yield* Effect.either(requestReview('review_2'))
        const stored = yield* reviews.listForWork(workId)
        return { second, count: stored.length }
      }),
    )
    if (result._tag === 'Success') {
      expect(result.value.second._tag).toBe('Left')
      expect(result.value.count).toBe(1)
    } else {
      throw new Error('expected the program to complete')
    }
  })

  it('emits no review.requested event for a refused request', () => {
    const result = run(
      Effect.gen(function* () {
        const events = yield* EventStore
        yield* readyWork
        yield* requestReview('review_1')
        yield* Effect.either(requestReview('review_2'))
        const log = yield* events.readAfter(workspaceId, 0)
        return Chunk.toReadonlyArray(log).filter(
          (event) => event.type === 'review.requested',
        ).length
      }),
    )
    if (result._tag === 'Success') expect(result.value).toBe(1)
  })

  it('persists no review when a live child blocks the parent', () => {
    // The spawn-graph completion gate refuses the transition, and the review
    // must not be written for a request that cannot succeed.
    const result = run(
      Effect.gen(function* () {
        const svc = yield* WorkUnitService
        const reviews = yield* ReviewService
        yield* readyWork
        yield* svc.create({
          id: Schema.decodeUnknownSync(WorkId)('work_child'),
          payload: Schema.decodeUnknownSync(CreateWorkPayload)({
            workspace_id: workspaceId,
            title: 'child',
            parent_id: 'work_1',
          }),
          createdBy: workerId,
          now,
        })
        const refused = yield* Effect.either(requestReview('review_1'))
        const stored = yield* reviews.listForWork(workId)
        return { refused, count: stored.length }
      }),
    )
    if (result._tag === 'Success') {
      expect(result.value.refused._tag).toBe('Left')
      expect(result.value.count).toBe(0)
    }
  })
})
