/** @Acp.Domain.Reviews.EnforcementReachability.Test — enforcement must not brick verdicts */
import { describe, expect, it } from 'vitest'
import { Cause, Effect, Exit, Layer, Option, Schema } from 'effect'
import { TestAppConfigLive } from '../../config/app-config-test-support.js'
import { CostServiceLive } from '../cost/index.js'
import { EventStoreLive, InProcessEventBrokerLive } from '../events/index.js'
import { NoHooksLive } from '../hooks/index.js'
import { InMemoryStorageLive } from '../../infrastructure/storage/index.js'
import { WorkerService, WorkerServiceLive } from '../workers/index.js'
import {
  canonicalAssertionPayload,
  publicKeyToBase64,
} from '../identity/index.js'
import { generateKeyPairSync, sign } from 'node:crypto'
import { Worker } from '../../protocol/schema/index.js'
import { WorkerIdentityServiceLive } from '../identity/index.js'
import { WorkUnitService, WorkUnitServiceLive } from '../work-units/index.js'
import { ReviewService, ReviewServiceLive } from './index.js'
import {
  CreateWorkPayload,
  RequestReviewPayload,
  Timestamp,
  WorkId,
  WorkerId,
  WorkspaceId,
} from '../../protocol/schema/index.js'
import type { ReviewId } from '../../protocol/schema/index.js'

const workerId = Schema.decodeUnknownSync(WorkerId)('agent_a')
const workspaceId = Schema.decodeUnknownSync(WorkspaceId)('workspace_c')
const workId = Schema.decodeUnknownSync(WorkId)('work_1')
const now = Schema.decodeUnknownSync(Timestamp)('2026-08-06T10:00:00Z')

const enforced = TestAppConfigLive({ requireWorkerSignatures: true })
const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const workersLive = WorkerServiceLive.pipe(Layer.provide(InMemoryStorageLive))

const signAs = (action: 'work.claim' | 'review.verdict', targetId: string) => {
  const claims = {
    workerId: 'agent_a',
    action,
    targetId,
    timestamp: now as string,
  }
  return {
    worker_id: workerId,
    action,
    target_id: targetId,
    timestamp: now,
    signature: sign(
      null,
      Buffer.from(canonicalAssertionPayload(claims), 'utf8'),
      privateKey,
    ).toString('base64'),
  }
}

const signVerdict = (targetId: string) => signAs('review.verdict', targetId)

const signClaim = (targetId: string) => {
  const claims = {
    workerId: 'agent_a',
    action: 'work.claim' as const,
    targetId,
    timestamp: now as string,
  }
  return {
    worker_id: workerId,
    action: 'work.claim' as const,
    target_id: targetId,
    timestamp: now,
    signature: sign(
      null,
      Buffer.from(canonicalAssertionPayload(claims), 'utf8'),
      privateKey,
    ).toString('base64'),
  }
}
const base = Layer.merge(
  Layer.provideMerge(
    EventStoreLive,
    Layer.merge(InMemoryStorageLive, InProcessEventBrokerLive),
  ),
  Layer.mergeAll(
    enforced,
    NoHooksLive,
    Layer.provide(
      WorkerIdentityServiceLive,
      Layer.merge(workersLive, enforced),
    ),
  ),
)
const cost = Layer.provideMerge(CostServiceLive, base)
const work = Layer.provideMerge(
  WorkUnitServiceLive,
  Layer.mergeAll(base, workersLive, cost),
)
const TestLive = Layer.provideMerge(ReviewServiceLive, work)

// Regression: enabling ACP_REQUIRE_WORKER_SIGNATURES once made every review
// verdict impossible. Verification lived in `transitionReview`, but no verdict
// transport could carry an assertion, so the host demanded proof no caller
// could supply. Provenance now travels as a header on every transport, and
// `cancel` takes an assertion like the other verdicts — so enforcement is
// satisfiable rather than a dead end.
describe('review verdicts under signature enforcement', () => {
  it('accepts a signed cancel', () => {
    const exit = Effect.runSyncExit(
      Effect.provide(
        Effect.gen(function* () {
          const workers = yield* WorkerService
          yield* workers.register(
            Schema.decodeUnknownSync(Worker)({
              id: 'agent_a',
              name: 'A',
              kind: 'agent',
              status: 'online',
              capabilities: [],
              public_key: publicKeyToBase64(publicKey),
            }),
          )
          const w = yield* WorkUnitService
          const reviews = yield* ReviewService
          yield* w.create({
            id: workId,
            payload: Schema.decodeUnknownSync(CreateWorkPayload)({
              workspace_id: workspaceId,
              title: 'T',
            }),
            createdBy: workerId,
            now,
          })
          yield* w.claim(workId, workerId, now, signClaim('work_1'))
          yield* w.transition(workId, 'running', workerId, now)
          yield* reviews.request({
            id: 'review_1' as ReviewId,
            payload: Schema.decodeUnknownSync(RequestReviewPayload)({
              work_id: 'work_1',
              requested_by: workerId,
              requirements: [],
            }),
            now,
          })
          return yield* reviews.cancel(
            'review_1' as ReviewId,
            workerId,
            now,
            signVerdict('review_1'),
          )
        }),
        TestLive,
      ),
    )
    if (Exit.isFailure(exit)) {
      const detail = Option.getOrNull(Cause.failureOption(exit.cause)) as {
        _tag?: string
        reason?: string
      } | null
      throw new Error(
        `cancel was refused: ${detail?._tag ?? 'unknown'} ${detail?.reason ?? ''}`,
      )
    }
    expect(Exit.isSuccess(exit)).toBe(true)
  })

  it('refuses an unsigned cancel, now that one can be signed', () => {
    const exit = Effect.runSyncExit(
      Effect.provide(
        Effect.gen(function* () {
          const workers = yield* WorkerService
          yield* workers.register(
            Schema.decodeUnknownSync(Worker)({
              id: 'agent_a',
              name: 'A',
              kind: 'agent',
              status: 'online',
              capabilities: [],
              public_key: publicKeyToBase64(publicKey),
            }),
          )
          const w = yield* WorkUnitService
          const reviews = yield* ReviewService
          yield* w.create({
            id: workId,
            payload: Schema.decodeUnknownSync(CreateWorkPayload)({
              workspace_id: workspaceId,
              title: 'T',
            }),
            createdBy: workerId,
            now,
          })
          yield* w.claim(workId, workerId, now, signClaim('work_1'))
          yield* w.transition(workId, 'running', workerId, now)
          yield* reviews.request({
            id: 'review_1' as ReviewId,
            payload: Schema.decodeUnknownSync(RequestReviewPayload)({
              work_id: 'work_1',
              requested_by: workerId,
              requirements: [],
            }),
            now,
          })
          return yield* reviews.cancel('review_1' as ReviewId, workerId, now)
        }),
        TestLive,
      ),
    )
    expect(Exit.isFailure(exit)).toBe(true)
  })
})
