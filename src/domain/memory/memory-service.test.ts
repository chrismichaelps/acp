/** @Acp.Domain.Memory.Service.Test — workspace recall records */
import { describe, expect, it } from 'vitest'
import { Chunk, Effect, Layer, Schema } from 'effect'
import { EventStore, EventStoreLive } from '../events/index.js'
import { InMemoryStorageLive } from '../../infrastructure/storage/index.js'
import {
  CreateMemoryPayload,
  MemoryId,
  ReadMemoryQuery,
  Timestamp,
  WorkerId,
} from '../../protocol/schema/index.js'
import { MemoryService, MemoryServiceLive } from './index.js'

const StorageAndEventsLive = Layer.provideMerge(
  EventStoreLive,
  InMemoryStorageLive,
)
const TestLive = Layer.provideMerge(MemoryServiceLive, StorageAndEventsLive)

const runSync = <A, E>(
  program: Effect.Effect<A, E, MemoryService | EventStore>,
): A => Effect.runSync(Effect.provide(program, TestLive))

const memoryId = Schema.decodeUnknownSync(MemoryId)('memory_first')
const secondMemoryId = Schema.decodeUnknownSync(MemoryId)('memory_second')
const actor = Schema.decodeUnknownSync(WorkerId)('agent_codex')
const now = Schema.decodeUnknownSync(Timestamp)('2026-06-26T05:00:00.000Z')

const payload = Schema.decodeUnknownSync(CreateMemoryPayload)({
  workspace_id: 'workspace_memory',
  work_id: 'work_memory',
  kind: 'decision',
  key: 'auth.redirect.async-session',
  summary: 'Redirect waits for session creation.',
  content: 'The callback awaits session creation before navigation.',
  labels: ['auth', 'handoff'],
})

const createInput = (id = memoryId, body = payload) => ({
  id,
  payload: body,
  createdBy: actor,
  now,
})

const query = (input: unknown) =>
  Schema.decodeUnknownSync(ReadMemoryQuery)(input)

describe('MemoryService', () => {
  it('creates a memory record, assigns seq, and emits memory.created', () => {
    const result = runSync(
      Effect.gen(function* () {
        const memory = yield* MemoryService
        const events = yield* EventStore
        const created = yield* memory.create(createInput())
        const log = yield* events.readAfter('workspace_memory', 0)
        return { created, log }
      }),
    )

    expect(result.created.seq).toBe(1)
    expect(
      Chunk.toReadonlyArray(result.log).map((event) => event.type),
    ).toEqual(['memory.created'])
  })

  it('reads memory by cursor and key through the service', () => {
    const ids = runSync(
      Effect.gen(function* () {
        const memory = yield* MemoryService
        yield* memory.create(createInput())
        yield* memory.create(
          createInput(
            secondMemoryId,
            Schema.decodeUnknownSync(CreateMemoryPayload)({
              workspace_id: 'workspace_memory',
              work_id: 'work_memory',
              kind: 'note',
              key: 'handoff.note',
              summary: 'Next worker note.',
              content: 'Run the auth tests after changing redirect timing.',
              labels: ['handoff'],
            }),
          ),
        )
        const records = yield* memory.read(
          query({
            workspace_id: 'workspace_memory',
            after_seq: 1,
            key: 'handoff.note',
          }),
        )
        return records.map((record) => record.id)
      }),
    )

    expect(ids).toEqual([secondMemoryId])
  })
})
