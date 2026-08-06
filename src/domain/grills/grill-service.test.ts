import { describe, it, expect } from 'vitest'
import { Effect, Exit, Layer, Option } from 'effect'
import { TestIdentityLive } from '../identity/identity-test-support.js'
import { InMemoryStorageLive } from '../../infrastructure/storage/index.js'
import { EventStoreLive, InProcessEventBrokerLive } from '../events/index.js'
import type { EventStore } from '../events/index.js'
import { ReviewCommentServiceLive } from '../review-comments/index.js'
import { GrillService, GrillServiceLive } from './index.js'

const StorageAndEventsLive = Layer.provideMerge(
  EventStoreLive,
  Layer.merge(InMemoryStorageLive, InProcessEventBrokerLive),
)
const ReviewCommentsProvidedLive = Layer.provideMerge(
  ReviewCommentServiceLive,
  StorageAndEventsLive,
)
const TestLive = Layer.provideMerge(
  GrillServiceLive,
  Layer.merge(ReviewCommentsProvidedLive, TestIdentityLive),
)

const openGrillWithBlocker = (svc: GrillService['Type']) =>
  Effect.gen(function* () {
    yield* svc.open({
      id: 'grill_1' as never,
      payload: {
        review_id: 'review_1' as never,
        work_id: 'work_1' as never,
        workspace_id: 'ws_1' as never,
      },
      openedBy: 'worker_1' as never,
      now: '2026-07-06T10:00:00Z' as never,
    })
    yield* svc.addQuestion('grill_1' as never, {
      id: 'grillquestion_1' as never,
      payload: { prompt: 'Why CAS-safe?', severity: 'blocker' },
      actor: 'worker_1' as never,
      now: '2026-07-06T10:01:00Z' as never,
    })
  })

const run = <A, E>(
  program: Effect.Effect<A, E, GrillService | EventStore>,
): A => Effect.runSync(Effect.provide(program, TestLive))

describe('GrillService — answer provenance', () => {
  // The grill gate rests on knowing who answered, so a bad signature must
  // refuse before the write rather than leaving a half-attributed answer.
  it('refuses an answer whose assertion does not verify, leaving it unanswered', () => {
    const exit = Effect.runSyncExit(
      Effect.provide(
        Effect.gen(function* () {
          const svc = yield* GrillService
          yield* openGrillWithBlocker(svc)
          const refused = yield* Effect.either(
            svc.answer('grillquestion_1' as never, {
              answer: 'version CAS',
              answeredBy: 'worker_2' as never,
              now: '2026-07-06T10:02:00Z' as never,
              assertion: {
                worker_id: 'worker_2' as never,
                action: 'grill.answer',
                target_id: 'grillquestion_1',
                timestamp: '2026-07-06T10:02:00Z' as never,
                signature: 'not-a-real-signature',
              },
            }),
          )
          const question = yield* svc.getQuestion('grillquestion_1' as never)
          return { refused, question }
        }),
        TestLive,
      ),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value.refused._tag).toBe('Left')
      // The answer never landed: attribution failed, so nothing was recorded.
      expect(Option.isNone(Option.getOrThrow(exit.value.question).answer)).toBe(
        true,
      )
    }
  })
})

describe('GrillService', () => {
  it('opens a grill (state open) and rejects a second open while one is open', () => {
    run(
      Effect.gen(function* () {
        const svc = yield* GrillService
        const g = yield* svc.open({
          id: 'grill_1' as never,
          payload: {
            review_id: 'review_1' as never,
            work_id: 'work_1' as never,
            workspace_id: 'ws_1' as never,
          },
          openedBy: 'worker_1' as never,
          now: '2026-07-06T10:00:00Z' as never,
        })
        expect(g.state).toBe('open')
        const second = yield* Effect.either(
          svc.open({
            id: 'grill_2' as never,
            payload: {
              review_id: 'review_1' as never,
              work_id: 'work_1' as never,
              workspace_id: 'ws_1' as never,
            },
            openedBy: 'worker_1' as never,
            now: '2026-07-06T10:05:00Z' as never,
          }),
        )
        expect(second._tag).toBe('Left')
      }),
    )
  })

  it('ask -> answer -> setVerdict flows through pending -> accepted', () => {
    run(
      Effect.gen(function* () {
        const svc = yield* GrillService
        yield* svc.open({
          id: 'grill_1' as never,
          payload: {
            review_id: 'review_1' as never,
            work_id: 'work_1' as never,
            workspace_id: 'ws_1' as never,
          },
          openedBy: 'worker_1' as never,
          now: '2026-07-06T10:00:00Z' as never,
        })
        const q = yield* svc.addQuestion('grill_1' as never, {
          id: 'grillquestion_1' as never,
          payload: { prompt: 'Why CAS-safe?', severity: 'blocker' },
          actor: 'worker_1' as never,
          now: '2026-07-06T10:01:00Z' as never,
        })
        expect(q.verdict).toBe('pending')
        yield* svc.answer('grillquestion_1' as never, {
          answer: 'version CAS',
          answeredBy: 'worker_2' as never,
          now: '2026-07-06T10:02:00Z' as never,
        })
        const decided = yield* svc.setVerdict(
          'grillquestion_1' as never,
          'accepted',
          'worker_1' as never,
          '2026-07-06T10:03:00Z' as never,
        )
        expect(decided.verdict).toBe('accepted')
      }),
    )
  })

  it('evaluate = incomplete while a blocker is pending, no state change', () => {
    run(
      Effect.gen(function* () {
        const grills = yield* GrillService
        yield* openGrillWithBlocker(grills)
        const result = yield* grills.evaluate(
          'grill_1' as never,
          '2026-07-06T10:04:00Z' as never,
        )
        expect(result.outcome).toBe('incomplete')
        expect(result.grill.state).toBe('open')
      }),
    )
  })

  it('evaluate = pass when all blockers accepted and no open comments', () => {
    run(
      Effect.gen(function* () {
        const grills = yield* GrillService
        yield* openGrillWithBlocker(grills)
        yield* grills.setVerdict(
          'grillquestion_1' as never,
          'accepted',
          'worker_1' as never,
          '2026-07-06T10:03:00Z' as never,
        )
        const result = yield* grills.evaluate(
          'grill_1' as never,
          '2026-07-06T10:04:00Z' as never,
        )
        expect(result.outcome).toBe('pass')
        expect(result.grill.state).toBe('passed')
      }),
    )
  })

  it('evaluate = fail with a rejected blocker, listing the reason', () => {
    run(
      Effect.gen(function* () {
        const grills = yield* GrillService
        yield* openGrillWithBlocker(grills)
        yield* grills.setVerdict(
          'grillquestion_1' as never,
          'rejected',
          'worker_1' as never,
          '2026-07-06T10:03:00Z' as never,
        )
        const result = yield* grills.evaluate(
          'grill_1' as never,
          '2026-07-06T10:04:00Z' as never,
        )
        expect(result.outcome).toBe('fail')
        expect(result.grill.state).toBe('failed')
        expect(result.blocking.length).toBeGreaterThan(0)
      }),
    )
  })
})
