import { describe, it, expect } from 'vitest'
import { Effect, Layer, Option, Schema } from 'effect'
import { InMemoryStorageLive } from '../../infrastructure/storage/index.js'
import { EventStoreLive, InProcessEventBrokerLive } from '../events/index.js'
import type { EventStore } from '../events/index.js'
import { ReviewCommentService, ReviewCommentServiceLive } from './index.js'
import {
  ReviewCommentId,
  Timestamp,
  WorkerId,
  ReviewId,
  WorkId,
  WorkspaceId,
  ArtifactId,
  AddReviewCommentPayload,
} from '../../protocol/schema/index.js'

const StorageAndEventsLive = Layer.provideMerge(
  EventStoreLive,
  Layer.merge(InMemoryStorageLive, InProcessEventBrokerLive),
)
const TestLive = Layer.provideMerge(
  ReviewCommentServiceLive,
  StorageAndEventsLive,
)

const runSync = <A, E>(
  program: Effect.Effect<A, E, ReviewCommentService | EventStore>,
): A => Effect.runSync(Effect.provide(program, TestLive))

const reviewCommentId =
  Schema.decodeUnknownSync(ReviewCommentId)('reviewcomment_1')
const reviewId = Schema.decodeUnknownSync(ReviewId)('review_1')
const workId = Schema.decodeUnknownSync(WorkId)('work_1')
const workspaceId = Schema.decodeUnknownSync(WorkspaceId)('ws_1')
const artifactId = Schema.decodeUnknownSync(ArtifactId)('artifact_1')
const timestamp = Schema.decodeUnknownSync(Timestamp)('2026-07-06T10:00:00Z')
const laterTimestamp = Schema.decodeUnknownSync(Timestamp)(
  '2026-07-06T11:00:00Z',
)
const worker1 = Schema.decodeUnknownSync(WorkerId)('worker_1')
const worker2 = Schema.decodeUnknownSync(WorkerId)('worker_2')

const payload = (
  over: Partial<AddReviewCommentPayload> = {},
): AddReviewCommentPayload =>
  Schema.decodeUnknownSync(AddReviewCommentPayload)({
    review_id: reviewId,
    work_id: workId,
    workspace_id: workspaceId,
    target: {
      artifact_id: artifactId,
      file: 'src/a.ts',
      line: 10,
      side: 'new',
    },
    body: 'needs a test',
    in_reply_to: null,
    ...over,
  })

describe('ReviewCommentService', () => {
  it('adds a comment (state open) and lists it by review', () => {
    const result = runSync(
      Effect.gen(function* () {
        const svc = yield* ReviewCommentService
        const added = yield* svc.add({
          id: reviewCommentId,
          payload: payload(),
          author: worker1,
          now: timestamp,
        })
        const listed = yield* svc.listForReview(reviewId)
        return { added, listed }
      }),
    )

    expect(result.added.state).toBe('open')
    expect(result.listed.map((c) => c.id)).toEqual([reviewCommentId])
  })

  it('resolve moves open -> resolved and stamps resolved_at', () => {
    const result = runSync(
      Effect.gen(function* () {
        const svc = yield* ReviewCommentService
        yield* svc.add({
          id: reviewCommentId,
          payload: payload(),
          author: worker1,
          now: timestamp,
        })
        const resolved = yield* svc.resolve(
          reviewCommentId,
          worker2,
          laterTimestamp,
        )
        return resolved
      }),
    )

    expect(result.state).toBe('resolved')
    expect(Option.isSome(result.resolved_at)).toBe(true)
  })

  it('setExternalId stamps a GitHub comment id without emitting a transition', () => {
    const result = runSync(
      Effect.gen(function* () {
        const svc = yield* ReviewCommentService
        yield* svc.add({
          id: reviewCommentId,
          payload: payload(),
          author: worker1,
          now: timestamp,
        })
        yield* svc.setExternalId(reviewCommentId, 'gh_c_9', laterTimestamp)
        const found = yield* svc.get(reviewCommentId)
        return found
      }),
    )

    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(Option.isSome(result.value.external_id)).toBe(true)
      expect(
        Option.isSome(result.value.external_id) &&
          result.value.external_id.value,
      ).toBe('gh_c_9')
    }
  })
})
