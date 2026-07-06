/** @Acp.Domain.WorkUnits.Service.Test — WorkUnit state machine */
import { describe, expect, it } from 'vitest'
import { Chunk, Effect, Layer, Option, Schema } from 'effect'
import {
  EventStore,
  EventStoreLive,
  InProcessEventBrokerLive,
} from '../events/index.js'
import { InMemoryStorageLive } from '../../infrastructure/storage/index.js'
import {
  ClaimWorkPayload,
  CreateWorkPayload,
  Timestamp,
  WorkId,
  WorkerId,
  WorkspaceId,
} from '../../protocol/schema/index.js'
import { WorkUnitService, WorkUnitServiceLive } from './index.js'
import type { CreateWorkInput } from './index.js'
import type { Event } from '../../protocol/schema/index.js'

const StorageAndEventsLive = Layer.provideMerge(
  EventStoreLive,
  Layer.merge(InMemoryStorageLive, InProcessEventBrokerLive),
)

const TestLive = Layer.provideMerge(WorkUnitServiceLive, StorageAndEventsLive)

const runSync = <A, E>(
  program: Effect.Effect<A, E, WorkUnitService | EventStore>,
): A => Effect.runSync(Effect.provide(program, TestLive))

const workId = Schema.decodeUnknownSync(WorkId)('work_state_machine')
const workerId = Schema.decodeUnknownSync(WorkerId)('agent_codex')
const workspaceId = Schema.decodeUnknownSync(WorkspaceId)('workspace_work')
const now = Schema.decodeUnknownSync(Timestamp)('2026-06-26T01:25:00Z')
const later = Schema.decodeUnknownSync(Timestamp)('2026-06-26T01:26:00Z')

const createPayload = Schema.decodeUnknownSync(CreateWorkPayload)({
  workspace_id: 'workspace_work',
  title: 'Implement WorkUnit state machine',
  priority: 'high',
})

const claimPayload = Schema.decodeUnknownSync(ClaimWorkPayload)({
  worker_id: 'agent_codex',
})

const createInput = (id = workId): CreateWorkInput => ({
  id,
  payload: createPayload,
  createdBy: workerId,
  now,
})

describe('WorkUnitService', () => {
  it('creates a work unit with defaults and emits work.created', () => {
    const result = runSync(
      Effect.gen(function* () {
        const work = yield* WorkUnitService
        const events = yield* EventStore
        const created = yield* work.create(createInput())
        const written = yield* work.get(workId)
        const log = yield* events.readAfter('workspace_work', 0)
        return { created, written, log }
      }),
    )

    expect(result.created.state).toBe('open')
    expect(Option.getOrNull(result.written)).toEqual(result.created)
    expect(
      Chunk.toReadonlyArray(result.log).map((event) => event.type),
    ).toEqual(['work.created'])
  })

  it('claims open work and assigns the worker', () => {
    const claimed = runSync(
      Effect.gen(function* () {
        const work = yield* WorkUnitService
        yield* work.create(
          createInput(Schema.decodeUnknownSync(WorkId)('work_claim')),
        )
        return yield* work.claim(
          Schema.decodeUnknownSync(WorkId)('work_claim'),
          claimPayload.worker_id,
          later,
        )
      }),
    )

    expect(claimed.state).toBe('claimed')
    expect(Option.getOrNull(claimed.assigned_to)).toBe(claimPayload.worker_id)
  })

  it('returns ClaimConflictError when another worker claims assigned work', () => {
    const error = runSync(
      Effect.either(
        Effect.gen(function* () {
          const id = Schema.decodeUnknownSync(WorkId)('work_claim_conflict')
          const otherWorker = Schema.decodeUnknownSync(WorkerId)('agent_other')
          const work = yield* WorkUnitService
          yield* work.create(createInput(id))
          yield* work.claim(id, claimPayload.worker_id, later)
          return yield* work.claim(id, otherWorker, later)
        }),
      ),
    )

    expect(error._tag).toBe('Left')
    if (error._tag === 'Left') {
      expect(error.left._tag).toBe('ClaimConflictError')
      const conflict = error.left as { readonly holderWorkerId: string }
      expect(conflict.holderWorkerId).toBe(claimPayload.worker_id)
    }
  })

  it('lists work units by workspace', () => {
    const listed = runSync(
      Effect.gen(function* () {
        const work = yield* WorkUnitService
        yield* work.create(
          createInput(Schema.decodeUnknownSync(WorkId)('work_workspace_a')),
        )
        yield* work.create(
          createInput(Schema.decodeUnknownSync(WorkId)('work_workspace_b')),
        )
        yield* work.create({
          ...createInput(Schema.decodeUnknownSync(WorkId)('work_workspace_c')),
          payload: Schema.decodeUnknownSync(CreateWorkPayload)({
            workspace_id: 'workspace_other',
            title: 'Other workspace',
          }),
        })
        return yield* work.listForWorkspace(workspaceId)
      }),
    )

    expect(listed.map((work) => work.id)).toEqual([
      'work_workspace_a',
      'work_workspace_b',
    ])
  })

  it('allows the review changes_requested path back to running', () => {
    const final = runSync(
      Effect.gen(function* () {
        const id = Schema.decodeUnknownSync(WorkId)('work_review_loop')
        const work = yield* WorkUnitService
        yield* work.create(createInput(id))
        yield* work.claim(id, workerId, later)
        yield* work.transition(id, 'running', workerId, later)
        yield* work.transition(id, 'needs_review', workerId, later)
        yield* work.transition(id, 'changes_requested', workerId, later)
        return yield* work.transition(id, 'running', workerId, later)
      }),
    )

    expect(final.state).toBe('running')
  })

  it('rejects a stale transition after a concurrent transition already moved the work on', () => {
    const error = runSync(
      Effect.either(
        Effect.gen(function* () {
          const id = Schema.decodeUnknownSync(WorkId)('work_stale_transition')
          const work = yield* WorkUnitService
          yield* work.create(createInput(id))
          yield* work.claim(id, workerId, later)
          yield* work.transition(id, 'running', workerId, later)
          // Simulates two racers both having observed `running`: one lands
          // first, moving the work to `needs_review`; the loser retries its
          // transition computed against the stale `running` snapshot and
          // must fail with the same conflict error the CAS write enforces.
          yield* work.transition(id, 'needs_review', workerId, later)
          return yield* work.transition(id, 'blocked', workerId, later)
        }),
      ),
    )

    expect(error._tag).toBe('Left')
    if (error._tag === 'Left') {
      expect(error.left._tag).toBe('InvalidStateTransitionError')
    }
  })

  it('rejects invalid transitions with InvalidStateTransitionError', () => {
    const error = runSync(
      Effect.either(
        Effect.gen(function* () {
          const id = Schema.decodeUnknownSync(WorkId)('work_invalid_transition')
          const work = yield* WorkUnitService
          yield* work.create(createInput(id))
          return yield* work.transition(id, 'completed', workerId, later)
        }),
      ),
    )

    expect(error._tag).toBe('Left')
    if (error._tag === 'Left') {
      expect(error.left._tag).toBe('InvalidStateTransitionError')
    }
  })

  it('returns NotFoundError for missing work', () => {
    const error = runSync(
      Effect.either(
        Effect.gen(function* () {
          const work = yield* WorkUnitService
          return yield* work.claim(
            Schema.decodeUnknownSync(WorkId)('work_missing'),
            workerId,
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

  it('emits ordered events for claim and state transitions', () => {
    const types = runSync(
      Effect.gen(function* () {
        const id = Schema.decodeUnknownSync(WorkId)('work_event_log')
        const work = yield* WorkUnitService
        const events = yield* EventStore
        yield* work.create(createInput(id))
        yield* work.claim(id, workerId, later)
        yield* work.transition(id, 'running', workerId, later)
        yield* work.transition(id, 'blocked', workerId, later)
        const log = yield* events.readAfter('workspace_work', 0)
        return Chunk.toReadonlyArray(log).map((event: Event) => event.type)
      }),
    )

    expect(types).toEqual([
      'work.created',
      'work.claimed',
      'work.started',
      'work.blocked',
    ])
  })
})
