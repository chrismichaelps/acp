/** @Acp.Domain.Grills.Service — forced senior-question review gate */
import { Chunk, Context, Effect, Layer, Option, Schema } from 'effect'
import { EventStore } from '../events/index.js'
import { Storage } from '../../infrastructure/storage/index.js'
import {
  NotFoundError,
  StorageError,
  InvalidStateTransitionError,
} from '../../protocol/errors/protocol-error.js'
import { Grill, GrillQuestion, Event } from '../../protocol/schema/index.js'
import type {
  OpenGrillPayload,
  AddGrillQuestionPayload,
  Grill as GrillType,
  GrillQuestion as GrillQuestionType,
  GrillId,
  GrillQuestionId,
  ReviewId,
  WorkerId,
  Timestamp,
  EventType,
} from '../../protocol/schema/index.js'

export interface OpenGrillInput {
  readonly id: GrillId
  readonly payload: OpenGrillPayload
  readonly openedBy: WorkerId
  readonly now: Timestamp
}

export interface AddGrillQuestionInput {
  readonly id: GrillQuestionId
  readonly payload: AddGrillQuestionPayload
  readonly actor: WorkerId
  readonly now: Timestamp
}

export interface AnswerGrillQuestionInput {
  readonly answer: string
  readonly answeredBy: WorkerId
  readonly now: Timestamp
}

export interface GrillServiceApi {
  readonly open: (
    input: OpenGrillInput,
  ) => Effect.Effect<GrillType, InvalidStateTransitionError | StorageError>
  readonly addQuestion: (
    grillId: GrillId,
    input: AddGrillQuestionInput,
  ) => Effect.Effect<
    GrillQuestionType,
    NotFoundError | InvalidStateTransitionError | StorageError
  >
  readonly answer: (
    questionId: GrillQuestionId,
    input: AnswerGrillQuestionInput,
  ) => Effect.Effect<GrillQuestionType, NotFoundError | StorageError>
  readonly setVerdict: (
    questionId: GrillQuestionId,
    verdict: 'accepted' | 'rejected',
    actor: WorkerId,
    now: Timestamp,
  ) => Effect.Effect<GrillQuestionType, NotFoundError | StorageError>
  readonly get: (grillId: GrillId) => Effect.Effect<
    Option.Option<{
      readonly grill: GrillType
      readonly questions: readonly GrillQuestionType[]
    }>,
    StorageError
  >
  readonly getQuestion: (
    questionId: GrillQuestionId,
  ) => Effect.Effect<Option.Option<GrillQuestionType>, StorageError>
  readonly listForReview: (
    reviewId: ReviewId,
  ) => Effect.Effect<readonly GrillType[], StorageError>
}

export class GrillService extends Context.Tag('GrillService')<
  GrillService,
  GrillServiceApi
>() {}

const grillCollection = 'grill'
const questionCollection = 'grill_question'

const decodeStoredGrill = (value: unknown) =>
  Schema.decodeUnknown(Grill)(value).pipe(
    Effect.mapError(
      (error) => new StorageError({ op: 'decode_grill', cause: String(error) }),
    ),
  )

const decodeStoredQuestion = (value: unknown) =>
  Schema.decodeUnknown(GrillQuestion)(value).pipe(
    Effect.mapError(
      (error) =>
        new StorageError({ op: 'decode_grill_question', cause: String(error) }),
    ),
  )

const oldestFirst = (a: GrillType, b: GrillType) =>
  Date.parse(a.created_at) - Date.parse(b.created_at)

const make = Effect.gen(function* () {
  const storage = yield* Storage
  const events = yield* EventStore

  const encodeGrill = (g: GrillType) =>
    Schema.encode(Grill)(g).pipe(
      Effect.mapError(
        (error) =>
          new StorageError({ op: 'encode_grill', cause: String(error) }),
      ),
    )

  const encodeQuestion = (q: GrillQuestionType) =>
    Schema.encode(GrillQuestion)(q).pipe(
      Effect.mapError(
        (error) =>
          new StorageError({
            op: 'encode_grill_question',
            cause: String(error),
          }),
      ),
    )

  const saveGrill = (g: GrillType) =>
    Effect.flatMap(encodeGrill(g), (encoded) =>
      storage.put(grillCollection, g.id, encoded),
    )

  const saveQuestion = (q: GrillQuestionType) =>
    Effect.flatMap(encodeQuestion(q), (encoded) =>
      storage.put(questionCollection, q.id, encoded),
    )

  const emit = (
    workspaceId: string,
    workId: string,
    actor: WorkerId,
    now: Timestamp,
    type: EventType,
    data: Record<string, unknown>,
    idSeed: string,
  ) =>
    Effect.flatMap(
      Schema.decodeUnknown(Event)({
        id: `event_${idSeed}_${type}_${now}`,
        type,
        workspace_id: workspaceId,
        work_id: workId,
        actor,
        timestamp: now,
        seq: 0,
        data,
      }).pipe(
        Effect.mapError(
          (error) =>
            new StorageError({
              op: 'decode_grill_event',
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

  const listForReview: GrillServiceApi['listForReview'] = (reviewId) =>
    Effect.flatMap(
      storage.queryBy(grillCollection, [
        { field: 'review_id', value: reviewId },
      ]),
      (rows) =>
        Effect.map(
          Effect.forEach(Chunk.toReadonlyArray(rows), decodeStoredGrill),
          (list) => [...list].sort(oldestFirst),
        ),
    )

  const listQuestions = (grillId: GrillId) =>
    Effect.flatMap(
      storage.queryBy(questionCollection, [
        { field: 'grill_id', value: grillId },
      ]),
      (rows) =>
        Effect.forEach(Chunk.toReadonlyArray(rows), decodeStoredQuestion),
    )

  const get: GrillServiceApi['get'] = (grillId) =>
    Effect.flatMap(storage.get(grillCollection, grillId), (stored) =>
      Option.match(stored, {
        onNone: () =>
          Effect.succeed(
            Option.none<{
              readonly grill: GrillType
              readonly questions: readonly GrillQuestionType[]
            }>(),
          ),
        onSome: (v) =>
          Effect.flatMap(decodeStoredGrill(v), (grill) =>
            Effect.map(listQuestions(grillId), (questions) =>
              Option.some({ grill, questions }),
            ),
          ),
      }),
    )

  const getQuestion: GrillServiceApi['getQuestion'] = (questionId) =>
    Effect.flatMap(storage.get(questionCollection, questionId), (stored) =>
      Option.match(stored, {
        onNone: () => Effect.succeed(Option.none<GrillQuestionType>()),
        onSome: (v) => Effect.map(decodeStoredQuestion(v), Option.some),
      }),
    )

  const open: GrillServiceApi['open'] = (input) =>
    Effect.gen(function* () {
      const existing = yield* listForReview(input.payload.review_id)
      const alreadyOpen = existing.find((g) => g.state === 'open')
      if (alreadyOpen !== undefined) {
        return yield* Effect.fail(
          new InvalidStateTransitionError({ from: 'open', to: 'open' }),
        )
      }
      const grill: GrillType = {
        id: input.id,
        review_id: input.payload.review_id,
        work_id: input.payload.work_id,
        workspace_id: input.payload.workspace_id,
        opened_by: input.openedBy,
        state: 'open',
        created_at: input.now,
        closed_at: Option.none(),
      }
      yield* saveGrill(grill)
      yield* emit(
        grill.workspace_id,
        grill.work_id,
        input.openedBy,
        input.now,
        'grill.opened',
        { grill_id: grill.id, review_id: grill.review_id },
        grill.id,
      )
      return grill
    })

  const requireGrill = (id: GrillId) =>
    Effect.flatMap(
      Effect.flatMap(storage.get(grillCollection, id), (stored) =>
        Option.match(stored, {
          onNone: () => Effect.succeed(Option.none<GrillType>()),
          onSome: (v) => Effect.map(decodeStoredGrill(v), Option.some),
        }),
      ),
      Option.match({
        onNone: () => Effect.fail(new NotFoundError({ entity: 'grill', id })),
        onSome: Effect.succeed,
      }),
    )

  const addQuestion: GrillServiceApi['addQuestion'] = (grillId, input) =>
    Effect.gen(function* () {
      const grill = yield* requireGrill(grillId)
      if (grill.state !== 'open') {
        return yield* Effect.fail(
          new InvalidStateTransitionError({ from: grill.state, to: 'open' }),
        )
      }
      const question: GrillQuestionType = {
        id: input.id,
        grill_id: grillId,
        prompt: input.payload.prompt,
        severity: input.payload.severity,
        answer: Option.none(),
        answered_by: Option.none(),
        verdict: 'pending',
        created_at: input.now,
        answered_at: Option.none(),
        decided_at: Option.none(),
      }
      yield* saveQuestion(question)
      yield* emit(
        grill.workspace_id,
        grill.work_id,
        input.actor,
        input.now,
        'grill.question_added',
        { grill_id: grillId, grill_question_id: question.id },
        question.id,
      )
      return question
    })

  const casQuestion = (
    id: GrillQuestionId,
    mutate: (q: GrillQuestionType) => GrillQuestionType,
  ) =>
    Effect.gen(function* () {
      const stored = yield* storage.getVersioned(questionCollection, id)
      const record = yield* Option.match(stored, {
        onNone: () =>
          Effect.fail(new NotFoundError({ entity: 'grill_question', id })),
        onSome: Effect.succeed,
      })
      const current = yield* decodeStoredQuestion(record.value)
      const next = mutate(current)
      const encoded = yield* encodeQuestion(next)
      const swapped = yield* storage.replaceIfVersion(
        questionCollection,
        id,
        record.version,
        encoded,
      )
      if (!swapped) {
        return yield* Effect.fail(
          new StorageError({ op: 'grill_question_conflict', cause: id }),
        )
      }
      return next
    })

  const answer: GrillServiceApi['answer'] = (questionId, input) =>
    Effect.gen(function* () {
      const next = yield* casQuestion(questionId, (q) => ({
        ...q,
        answer: Option.some(input.answer),
        answered_by: Option.some(input.answeredBy),
        answered_at: Option.some(input.now),
      }))
      const grill = yield* requireGrill(next.grill_id)
      yield* emit(
        grill.workspace_id,
        grill.work_id,
        input.answeredBy,
        input.now,
        'grill.answered',
        { grill_id: next.grill_id, grill_question_id: next.id },
        next.id,
      )
      return next
    })

  const setVerdict: GrillServiceApi['setVerdict'] = (
    questionId,
    verdict,
    actor,
    now,
  ) =>
    Effect.gen(function* () {
      const next = yield* casQuestion(questionId, (q) => ({
        ...q,
        verdict,
        decided_at: Option.some(now),
      }))
      const grill = yield* requireGrill(next.grill_id)
      yield* emit(
        grill.workspace_id,
        grill.work_id,
        actor,
        now,
        'grill.verdict_set',
        { grill_id: next.grill_id, grill_question_id: next.id, verdict },
        next.id,
      )
      return next
    })

  return {
    open,
    addQuestion,
    answer,
    setVerdict,
    get,
    getQuestion,
    listForReview,
  } satisfies GrillServiceApi
})

export const GrillServiceLive: Layer.Layer<
  GrillService,
  never,
  Storage | EventStore
> = Layer.effect(GrillService, make)
