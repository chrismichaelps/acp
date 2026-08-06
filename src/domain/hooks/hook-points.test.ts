/** @Acp.Domain.Hooks.Points.Test — every gated point actually dispatches */
import { describe, expect, it } from 'vitest'
import { Cause, Effect, Exit, Layer, Option, Schema } from 'effect'
import { TestIdentityLive } from '../identity/identity-test-support.js'
import { TestAppConfigLive } from '../../config/app-config-test-support.js'
import { EventStoreLive, InProcessEventBrokerLive } from '../events/index.js'
import { InMemoryStorageLive } from '../../infrastructure/storage/index.js'
import { LeaseService, LeaseServiceLive } from '../leases/index.js'
import { ReviewService, ReviewServiceLive } from '../reviews/index.js'
import { WorkUnitService, WorkUnitServiceLive } from '../work-units/index.js'
import {
  CreateWorkPayload,
  RequestLeasePayload,
  RequestReviewPayload,
  Timestamp,
  WorkId,
  WorkerId,
  WorkspaceId,
} from '../../protocol/schema/index.js'
import type { ReviewId, LeaseId } from '../../protocol/schema/index.js'
import { allow, denyAbort } from './hook.js'
import type { Hook, HookPayload, HookPoint } from './hook.js'
import { HookDispatcherLive } from './hook-dispatcher.js'

const workerId = Schema.decodeUnknownSync(WorkerId)('agent_alpha')
const workspaceId = Schema.decodeUnknownSync(WorkspaceId)('workspace_hooks')
const now = Schema.decodeUnknownSync(Timestamp)('2026-08-04T10:00:00Z')
const id = (raw: string) => Schema.decodeUnknownSync(WorkId)(raw)

/** Captures every payload a hook sees, so dispatch is observable per point. */
const spy = (point: HookPoint, outcome = allow) => {
  const seen: HookPayload[] = []
  const hook: Hook = {
    name: 'spy',
    point,
    run: (payload) =>
      Effect.as(
        Effect.sync(() => seen.push(payload)),
        outcome,
      ),
  }
  return { seen, hook }
}

const layerWith = (hooks: readonly Hook[]) => {
  const base = Layer.merge(
    Layer.provideMerge(
      EventStoreLive,
      Layer.merge(InMemoryStorageLive, InProcessEventBrokerLive),
    ),
    Layer.mergeAll(
      TestAppConfigLive(),
      HookDispatcherLive(hooks),
      TestIdentityLive,
    ),
  )
  const work = Layer.provideMerge(WorkUnitServiceLive, base)
  return Layer.mergeAll(
    work,
    Layer.provideMerge(LeaseServiceLive, base),
    Layer.provideMerge(ReviewServiceLive, work),
  )
}

type Env = WorkUnitService | LeaseService | ReviewService

const runExit = <A, E>(
  program: Effect.Effect<A, E, Env>,
  hooks: readonly Hook[],
): Exit.Exit<A, E> =>
  Effect.runSyncExit(Effect.provide(program, layerWith(hooks)))

const failureTag = <A, E>(exit: Exit.Exit<A, E>): string => {
  if (Exit.isSuccess(exit)) return 'Success'
  return Option.match(Cause.failureOption(exit.cause), {
    onNone: () => 'Defect',
    onSome: (error) => (error as { _tag?: string })._tag ?? String(error),
  })
}

const createWork = (raw: string) =>
  Effect.flatMap(WorkUnitService, (svc) =>
    svc.create({
      id: id(raw),
      payload: Schema.decodeUnknownSync(CreateWorkPayload)({
        workspace_id: workspaceId,
        title: 'Task',
      }),
      createdBy: workerId,
      now,
    }),
  )

const requestLease = Effect.flatMap(LeaseService, (svc) =>
  svc.request({
    id: 'lease_1' as LeaseId,
    payload: Schema.decodeUnknownSync(RequestLeasePayload)({
      workspace_id: workspaceId,
      holder: workerId,
      resource: { kind: 'file', uri: 'file:///src/app.ts' },
    }),
    now,
  }),
)

/** Drives work to `needs_review` and opens a review over it. */
const openReview = Effect.gen(function* () {
  const work = yield* WorkUnitService
  const reviews = yield* ReviewService
  yield* createWork('work_1')
  yield* work.claim(id('work_1'), workerId, now)
  yield* work.transition(id('work_1'), 'running', workerId, now)
  return yield* reviews.request({
    id: 'review_1' as ReviewId,
    payload: Schema.decodeUnknownSync(RequestReviewPayload)({
      work_id: 'work_1',
      requested_by: workerId,
      requirements: [],
    }),
    now,
  })
})

describe('hook points — work.before_claim', () => {
  it('dispatches with the work unit as subject', () => {
    const { seen, hook } = spy('work.before_claim')
    runExit(
      Effect.flatMap(WorkUnitService, (svc) =>
        Effect.zipRight(
          createWork('work_1'),
          svc.claim(id('work_1'), workerId, now),
        ),
      ),
      [hook],
    )
    expect(seen).toHaveLength(1)
    expect(seen[0]?.subjectId).toBe('work_1')
    expect(seen[0]?.actor).toBe(workerId)
    expect(seen[0]?.workspaceId).toBe(workspaceId)
  })

  it('refuses the claim on DenyAbort and leaves the unit open', () => {
    const { hook } = spy('work.before_claim', denyAbort('claims frozen'))
    const exit = runExit(
      Effect.gen(function* () {
        const svc = yield* WorkUnitService
        yield* createWork('work_1')
        const refused = yield* Effect.either(
          svc.claim(id('work_1'), workerId, now),
        )
        const stored = yield* svc.get(id('work_1'))
        return { refused, state: Option.getOrThrow(stored).state }
      }),
      [hook],
    )
    const result = Exit.isSuccess(exit) ? exit.value : undefined
    expect(result?.state).toBe('open')
    expect(
      result?.refused._tag === 'Left' ? result.refused.left._tag : 'none',
    ).toBe('HookDeniedError')
  })
})

describe('hook points — work.before_transition', () => {
  it('dispatches with the from and to states', () => {
    const { seen, hook } = spy('work.before_transition')
    runExit(
      Effect.flatMap(WorkUnitService, (svc) =>
        Effect.gen(function* () {
          yield* createWork('work_1')
          yield* svc.claim(id('work_1'), workerId, now)
          yield* svc.transition(id('work_1'), 'running', workerId, now)
        }),
      ),
      [hook],
    )
    expect(seen).toHaveLength(1)
    expect(seen[0]?.detail).toEqual({ from: 'claimed', to: 'running' })
  })

  it('refuses the transition on DenyAbort', () => {
    const { hook } = spy('work.before_transition', denyAbort('frozen'))
    const exit = runExit(
      Effect.flatMap(WorkUnitService, (svc) =>
        Effect.gen(function* () {
          yield* createWork('work_1')
          yield* svc.claim(id('work_1'), workerId, now)
          return yield* svc.transition(id('work_1'), 'running', workerId, now)
        }),
      ),
      [hook],
    )
    expect(failureTag(exit)).toBe('HookDeniedError')
  })
})

describe('hook points — lease.before_grant', () => {
  it('dispatches with the resource uri as subject', () => {
    const { seen, hook } = spy('lease.before_grant')
    runExit(requestLease, [hook])
    expect(seen).toHaveLength(1)
    expect(seen[0]?.subjectId).toBe('file:///src/app.ts')
    expect(seen[0]?.detail).toEqual({ resource_kind: 'file' })
  })

  it('refuses the grant on DenyAbort', () => {
    const { hook } = spy('lease.before_grant', denyAbort('release freeze'))
    expect(failureTag(runExit(requestLease, [hook]))).toBe('HookDeniedError')
  })
})

describe('hook points — review.before_verdict', () => {
  it('dispatches with the review as subject and the verdict in detail', () => {
    const { seen, hook } = spy('review.before_verdict')
    runExit(
      Effect.gen(function* () {
        const reviews = yield* ReviewService
        yield* openReview
        yield* reviews.approve('review_1' as ReviewId, workerId, now, [])
      }),
      [hook],
    )
    expect(seen).toHaveLength(1)
    expect(seen[0]?.subjectId).toBe('review_1')
    expect(seen[0]?.detail).toEqual({
      verdict: 'approved',
      work_id: 'work_1',
    })
  })

  it('refuses the verdict on DenyAbort', () => {
    const { hook } = spy('review.before_verdict', denyAbort('needs a human'))
    const exit = runExit(
      Effect.gen(function* () {
        const reviews = yield* ReviewService
        yield* openReview
        return yield* reviews.approve('review_1' as ReviewId, workerId, now, [])
      }),
      [hook],
    )
    expect(failureTag(exit)).toBe('HookDeniedError')
  })
})

describe('hook points — a host with no hooks', () => {
  it('leaves every gated operation unaffected', () => {
    const exit = runExit(
      Effect.gen(function* () {
        const work = yield* WorkUnitService
        yield* createWork('work_1')
        yield* work.claim(id('work_1'), workerId, now)
        yield* work.transition(id('work_1'), 'running', workerId, now)
        yield* requestLease
        return 'ok'
      }),
      [],
    )
    expect(Exit.isSuccess(exit)).toBe(true)
  })
})
