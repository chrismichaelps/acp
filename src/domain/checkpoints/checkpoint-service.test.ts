/** @Acp.Domain.Checkpoints.Service.Test — append-only resume points */
import { describe, expect, it } from 'vitest'
import { Chunk, Effect, Layer, Option, Schema } from 'effect'
import {
  EventStore,
  EventStoreLive,
  InProcessEventBrokerLive,
} from '../events/index.js'
import { InMemoryStorageLive } from '../../infrastructure/storage/index.js'
import {
  CheckpointId,
  CreateCheckpointPayload,
  Timestamp,
  WorkerId,
  WorkspaceId,
  WorkId,
} from '../../protocol/schema/index.js'
import { CheckpointService, CheckpointServiceLive } from './index.js'
import type { Event } from '../../protocol/schema/index.js'

const StorageAndEventsLive = Layer.provideMerge(
  EventStoreLive,
  Layer.merge(InMemoryStorageLive, InProcessEventBrokerLive),
)
const TestLive = Layer.provideMerge(CheckpointServiceLive, StorageAndEventsLive)

const runSync = <A, E>(
  program: Effect.Effect<A, E, CheckpointService | EventStore>,
): A => Effect.runSync(Effect.provide(program, TestLive))

const checkpointId = Schema.decodeUnknownSync(CheckpointId)('checkpoint_first')
const secondCheckpointId =
  Schema.decodeUnknownSync(CheckpointId)('checkpoint_second')
const workspaceId = Schema.decodeUnknownSync(WorkspaceId)(
  'workspace_checkpoint',
)
const otherWorkspaceId =
  Schema.decodeUnknownSync(WorkspaceId)('workspace_other')
const workId = Schema.decodeUnknownSync(WorkId)('work_checkpoint')
const otherWorkId = Schema.decodeUnknownSync(WorkId)('work_other')
const actor = Schema.decodeUnknownSync(WorkerId)('agent_codex')
const now = Schema.decodeUnknownSync(Timestamp)('2026-06-26T05:00:00.000Z')
const later = Schema.decodeUnknownSync(Timestamp)('2026-06-26T05:05:00.000Z')

const payload = Schema.decodeUnknownSync(CreateCheckpointPayload)({
  workspace_id: workspaceId,
  work_id: workId,
  summary: 'Found failing redirect path',
  completed_steps: ['read auth callback', 'added failing test'],
  remaining_steps: ['fix redirect timing'],
  modified_resources: ['file://src/auth/callback.ts'],
})

const createInput = (id = checkpointId, body = payload, at = now) => ({
  id,
  payload: body,
  createdBy: actor,
  now: at,
})

describe('CheckpointService', () => {
  it('creates a checkpoint, persists it, and emits checkpoint.created', () => {
    const result = runSync(
      Effect.gen(function* () {
        const checkpoints = yield* CheckpointService
        const events = yield* EventStore
        const created = yield* checkpoints.create(createInput())
        const stored = yield* checkpoints.get(checkpointId)
        const log = yield* events.readAfter(workspaceId, 0)
        return { created, stored, log }
      }),
    )

    expect(result.created.summary).toBe('Found failing redirect path')
    expect(Option.getOrNull(result.stored)).toEqual(result.created)
    expect(
      Chunk.toReadonlyArray(result.log).map((event: Event) => event.type),
    ).toEqual(['checkpoint.created'])
  })

  it('lists checkpoints by work with newest first', () => {
    const ids = runSync(
      Effect.gen(function* () {
        const checkpoints = yield* CheckpointService
        yield* checkpoints.create(createInput())
        yield* checkpoints.create(
          createInput(secondCheckpointId, payload, later),
        )
        yield* checkpoints.create(
          createInput(
            Schema.decodeUnknownSync(CheckpointId)('checkpoint_other_work'),
            Schema.decodeUnknownSync(CreateCheckpointPayload)({
              workspace_id: workspaceId,
              work_id: otherWorkId,
              summary: 'Other work',
              completed_steps: [],
              remaining_steps: [],
              modified_resources: [],
            }),
            later,
          ),
        )
        const all = yield* checkpoints.listForWork(workId)
        return all.map((checkpoint) => checkpoint.id)
      }),
    )

    expect(ids).toEqual([secondCheckpointId, checkpointId])
  })

  it('lists checkpoints by workspace', () => {
    const ids = runSync(
      Effect.gen(function* () {
        const checkpoints = yield* CheckpointService
        yield* checkpoints.create(createInput())
        yield* checkpoints.create(
          createInput(
            secondCheckpointId,
            Schema.decodeUnknownSync(CreateCheckpointPayload)({
              workspace_id: otherWorkspaceId,
              work_id: otherWorkId,
              summary: 'Other workspace',
              completed_steps: [],
              remaining_steps: [],
              modified_resources: [],
            }),
            later,
          ),
        )
        const all = yield* checkpoints.listForWorkspace(workspaceId)
        return all.map((checkpoint) => checkpoint.id)
      }),
    )

    expect(ids).toEqual([checkpointId])
  })

  it('returns the latest checkpoint for a work unit', () => {
    const latest = runSync(
      Effect.gen(function* () {
        const checkpoints = yield* CheckpointService
        yield* checkpoints.create(createInput())
        yield* checkpoints.create(
          createInput(secondCheckpointId, payload, later),
        )
        return yield* checkpoints.latestForWork(workId)
      }),
    )

    expect(Option.getOrNull(latest)?.id).toBe(secondCheckpointId)
  })

  it('returns Option.none for missing checkpoint and latest work', () => {
    const result = runSync(
      Effect.gen(function* () {
        const checkpoints = yield* CheckpointService
        const stored = yield* checkpoints.get(
          Schema.decodeUnknownSync(CheckpointId)('checkpoint_missing'),
        )
        const latest = yield* checkpoints.latestForWork(
          Schema.decodeUnknownSync(WorkId)('work_missing'),
        )
        return { stored, latest }
      }),
    )

    expect(Option.isNone(result.stored)).toBe(true)
    expect(Option.isNone(result.latest)).toBe(true)
  })
})
