/** @Acp.Domain.Events.EventStore.Test — persistence + live fan-out */
import { describe, expect, it } from 'vitest'
import { Chunk, Effect, Fiber, Layer, Option, Schema, Stream } from 'effect'
import { InMemoryStorageLive } from '../../infrastructure/storage/index.js'
import { Event } from '../../protocol/schema/index.js'
import { EventStore, EventStoreLive } from './index.js'
import type { EventDraft } from './index.js'

const TestEventStoreLive = EventStoreLive.pipe(
  Layer.provide(InMemoryStorageLive),
)

const runSync = <A, E>(program: Effect.Effect<A, E, EventStore>): A =>
  Effect.runSync(Effect.provide(program, TestEventStoreLive))

const runPromise = <A, E>(
  program: Effect.Effect<A, E, EventStore>,
): Promise<A> => Effect.runPromise(Effect.provide(program, TestEventStoreLive))

const draft = (workspace: string, type = 'work.progressed'): EventDraft => {
  const full = Schema.decodeUnknownSync(Event)({
    id: `event_${workspace}_${type}`,
    type,
    workspace_id: workspace,
    actor: 'agent_codex',
    timestamp: '2026-06-26T01:15:00Z',
    seq: 0,
    data: { message: 'progress' },
  })
  return {
    id: full.id,
    type: full.type,
    workspace_id: full.workspace_id,
    work_id: full.work_id,
    actor: full.actor,
    timestamp: full.timestamp,
    data: full.data,
  }
}

describe('EventStore', () => {
  it('appends events through storage and returns assigned seq', () => {
    const seqs = runSync(
      Effect.gen(function* () {
        const store = yield* EventStore
        const first = yield* store.append(draft('workspace_events'))
        const second = yield* store.append(draft('workspace_events'))
        return [first.seq, second.seq] as const
      }),
    )

    expect(seqs).toEqual([1, 2])
  })

  it('reads persisted events after a per-workspace seq', () => {
    const after = runSync(
      Effect.gen(function* () {
        const store = yield* EventStore
        yield* store.append(draft('workspace_replay'))
        const expected = yield* store.append(draft('workspace_replay'))
        const events = yield* store.readAfter('workspace_replay', 1)
        return { expected, events }
      }),
    )

    expect(Chunk.toReadonlyArray(after.events)).toEqual([after.expected])
  })

  it('returns an empty batch when a workspace has no events', () => {
    const count = runSync(
      Effect.gen(function* () {
        const store = yield* EventStore
        const events = yield* store.readAfter('workspace_missing', 0)
        return Chunk.size(events)
      }),
    )

    expect(count).toBe(0)
  })

  it('publishes live events only to matching workspace subscribers', async () => {
    const result = await runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const store = yield* EventStore
          const stream = yield* store.subscribe('workspace_live')
          const fiber = yield* Effect.fork(Stream.runHead(stream))

          yield* store.append(draft('workspace_other'))
          const expected = yield* store.append(draft('workspace_live'))
          const observed = yield* Fiber.join(fiber)
          return { expected, observed }
        }),
      ),
    )

    expect(Option.getOrNull(result.observed)).toEqual(result.expected)
  })
})
