/** @Acp.Domain.ReviewComments.Service — diff-anchored review remarks */
import { Chunk, Context, Effect, Layer, Option, Schema } from 'effect'
import { EventStore } from '../events/index.js'
import { Storage } from '../../infrastructure/storage/index.js'
import {
  NotFoundError,
  StorageError,
  InvalidStateTransitionError,
} from '../../protocol/errors/protocol-error.js'
import { ReviewComment, Event } from '../../protocol/schema/index.js'
import type {
  AddReviewCommentPayload,
  ReviewComment as ReviewCommentType,
  ReviewCommentId,
  ReviewId,
  WorkId,
  WorkerId,
  Timestamp,
  EventType,
} from '../../protocol/schema/index.js'

export interface AddReviewCommentInput {
  readonly id: ReviewCommentId
  readonly payload: AddReviewCommentPayload
  readonly author: WorkerId
  readonly now: Timestamp
}

export type ReviewCommentTransitionError =
  NotFoundError | InvalidStateTransitionError | StorageError

export interface ReviewCommentServiceApi {
  readonly add: (
    input: AddReviewCommentInput,
  ) => Effect.Effect<ReviewCommentType, StorageError>
  readonly resolve: (
    id: ReviewCommentId,
    actor: WorkerId,
    now: Timestamp,
  ) => Effect.Effect<ReviewCommentType, ReviewCommentTransitionError>
  readonly reopen: (
    id: ReviewCommentId,
    actor: WorkerId,
    now: Timestamp,
  ) => Effect.Effect<ReviewCommentType, ReviewCommentTransitionError>
  readonly setExternalId: (
    id: ReviewCommentId,
    externalId: string,
    now: Timestamp,
  ) => Effect.Effect<ReviewCommentType, ReviewCommentTransitionError>
  readonly get: (
    id: ReviewCommentId,
  ) => Effect.Effect<Option.Option<ReviewCommentType>, StorageError>
  readonly listForReview: (
    reviewId: ReviewId,
  ) => Effect.Effect<readonly ReviewCommentType[], StorageError>
  readonly listForWork: (
    workId: WorkId,
  ) => Effect.Effect<readonly ReviewCommentType[], StorageError>
}

export class ReviewCommentService extends Context.Tag('ReviewCommentService')<
  ReviewCommentService,
  ReviewCommentServiceApi
>() {}

const collection = 'review_comment'

const decodeStored = (value: unknown) =>
  Schema.decodeUnknown(ReviewComment)(value).pipe(
    Effect.mapError(
      (error) =>
        new StorageError({
          op: 'decode_review_comment',
          cause: String(error),
        }),
    ),
  )

const oldestFirst = (a: ReviewCommentType, b: ReviewCommentType) =>
  Date.parse(a.created_at) - Date.parse(b.created_at)

const make = Effect.gen(function* () {
  const storage = yield* Storage
  const events = yield* EventStore

  const encode = (c: ReviewCommentType) =>
    Schema.encode(ReviewComment)(c).pipe(
      Effect.mapError(
        (error) =>
          new StorageError({
            op: 'encode_review_comment',
            cause: String(error),
          }),
      ),
    )

  const save = (c: ReviewCommentType) =>
    Effect.flatMap(encode(c), (encoded) =>
      storage.put(collection, c.id, encoded),
    )

  const emit = (
    c: ReviewCommentType,
    actor: WorkerId,
    now: Timestamp,
    type: EventType,
  ) =>
    Effect.flatMap(
      Schema.decodeUnknown(Event)({
        id: `event_${c.id}_${type}_${now}`,
        type,
        workspace_id: c.workspace_id,
        work_id: c.work_id,
        actor,
        timestamp: now,
        seq: 0,
        data: {
          review_comment_id: c.id,
          review_id: c.review_id,
        },
      }).pipe(
        Effect.mapError(
          (error) =>
            new StorageError({
              op: 'decode_review_comment_event',
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

  const queryDecoded = (field: 'review_id' | 'work_id', value: string) =>
    Effect.flatMap(storage.queryBy(collection, [{ field, value }]), (rows) =>
      Effect.map(
        Effect.forEach(Chunk.toReadonlyArray(rows), decodeStored),
        (list) => [...list].sort(oldestFirst),
      ),
    )

  const get: ReviewCommentServiceApi['get'] = (id) =>
    Effect.flatMap(storage.get(collection, id), (stored) =>
      Option.match(stored, {
        onNone: () => Effect.succeed(Option.none<ReviewCommentType>()),
        onSome: (v) => Effect.map(decodeStored(v), Option.some),
      }),
    )

  const requireComment = (id: ReviewCommentId) =>
    Effect.flatMap(
      get(id),
      Option.match({
        onNone: () =>
          Effect.fail(
            new NotFoundError({
              entity: 'review_comment',
              id,
            }),
          ),
        onSome: Effect.succeed,
      }),
    )

  const add: ReviewCommentServiceApi['add'] = (input) => {
    const comment: ReviewCommentType = {
      id: input.id,
      review_id: input.payload.review_id,
      work_id: input.payload.work_id,
      workspace_id: input.payload.workspace_id,
      author: input.author,
      target: input.payload.target,
      body: input.payload.body,
      state: 'open',
      in_reply_to: input.payload.in_reply_to,
      created_at: input.now,
      resolved_at: Option.none(),
      origin: input.payload.origin,
      external_id: input.payload.external_id,
    }
    return Effect.gen(function* () {
      yield* save(comment)
      yield* emit(comment, input.author, input.now, 'review_comment.added')
      return comment
    })
  }

  const transition = (
    id: ReviewCommentId,
    actor: WorkerId,
    now: Timestamp,
    from: ReviewCommentType['state'],
    to: ReviewCommentType['state'],
    type: EventType,
    resolvedAt: Option.Option<Timestamp>,
  ) =>
    Effect.gen(function* () {
      const current = yield* requireComment(id)
      if (current.state !== from) {
        return yield* Effect.fail(
          new InvalidStateTransitionError({
            from: current.state,
            to,
          }),
        )
      }
      const next: ReviewCommentType = {
        ...current,
        state: to,
        resolved_at: resolvedAt,
      }
      yield* save(next)
      yield* emit(next, actor, now, type)
      return next
    })

  const resolve: ReviewCommentServiceApi['resolve'] = (id, actor, now) =>
    transition(
      id,
      actor,
      now,
      'open',
      'resolved',
      'review_comment.resolved',
      Option.some(now),
    )

  const reopen: ReviewCommentServiceApi['reopen'] = (id, actor, now) =>
    transition(
      id,
      actor,
      now,
      'resolved',
      'open',
      'review_comment.reopened',
      Option.none(),
    )

  const listForReview: ReviewCommentServiceApi['listForReview'] = (reviewId) =>
    queryDecoded('review_id', reviewId)

  const listForWork: ReviewCommentServiceApi['listForWork'] = (workId) =>
    queryDecoded('work_id', workId)

  const setExternalId: ReviewCommentServiceApi['setExternalId'] = (
    id,
    externalId,
  ) =>
    Effect.gen(function* () {
      const current = yield* requireComment(id)
      const next: ReviewCommentType = {
        ...current,
        external_id: Option.some(externalId),
      }
      yield* save(next)
      return next
    })

  return {
    add,
    resolve,
    reopen,
    setExternalId,
    get,
    listForReview,
    listForWork,
  } satisfies ReviewCommentServiceApi
})

export const ReviewCommentServiceLive: Layer.Layer<
  ReviewCommentService,
  never,
  Storage | EventStore
> = Layer.effect(ReviewCommentService, make)
