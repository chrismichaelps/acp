/** @Acp.Domain.Events.EventRetention.Test — retention/replay contract, cross-adapter */
import { describe, expect, it } from 'vitest'
import { Chunk, Effect, Layer, Schema } from 'effect'
import {
  InMemoryStorageLive,
  makePostgresStorageLive,
  SqliteMemoryStorageLive,
} from '../../infrastructure/storage/index.js'
import type { Storage } from '../../infrastructure/storage/index.js'
import type { StorageError } from '../../protocol/errors/protocol-error.js'
import { Event } from '../../protocol/schema/index.js'
import {
  EventStore,
  EventStoreLive,
  InProcessEventBrokerLive,
} from './index.js'
import type { EventDraft } from './index.js'

const T1 = '2026-01-01T00:00:00Z'
const T2 = '2026-02-01T00:00:00Z'
const T3 = '2026-03-01T00:00:00Z'
const FUTURE = '2027-01-01T00:00:00Z'

const draft = (
  workspace: string,
  id: string,
  timestamp: string,
): EventDraft => {
  const full = Schema.decodeUnknownSync(Event)({
    id: `event_${workspace}_${id}`,
    type: 'work.progressed',
    workspace_id: workspace,
    actor: 'agent_codex',
    timestamp,
    seq: 0,
    data: { message: id },
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

const ids = (events: Chunk.Chunk<Event>): readonly string[] =>
  Chunk.toReadonlyArray(events).map((e) => e.id)

// The retention contract must hold identically on every adapter, so the body is
// written once and run over each storage layer. Each `run` provides the layer
// fresh, so a `:memory:` sqlite / in-memory store starts empty per test.
const eventStoreOver = (storage: Layer.Layer<Storage, StorageError>) =>
  EventStoreLive.pipe(
    Layer.provide(Layer.merge(storage, InProcessEventBrokerLive)),
  )

const contract = (storage: Layer.Layer<Storage, StorageError>) => {
  const run = <A, E>(program: Effect.Effect<A, E, EventStore>): Promise<A> =>
    Effect.runPromise(Effect.provide(program, eventStoreOver(storage)))

  it('replays only retained events in seq order after a prune', async () => {
    const result = await run(
      Effect.gen(function* () {
        const store = yield* EventStore
        yield* store.append(draft('ret_replay', 'e1', T1))
        yield* store.append(draft('ret_replay', 'e2', T2))
        yield* store.append(draft('ret_replay', 'e3', T3))
        const removed = yield* store.pruneBefore(T2)
        const retained = yield* store.readAfter('ret_replay', 0)
        return { removed, retained: ids(retained) }
      }),
    )
    expect(result.removed).toBe(1)
    expect(result.retained).toEqual([
      'event_ret_replay_e2',
      'event_ret_replay_e3',
    ])
  })

  it('resumes a cursor below the prune horizon without erroring', async () => {
    const result = await run(
      Effect.gen(function* () {
        const store = yield* EventStore
        const e1 = yield* store.append(draft('ret_cursor', 'e1', T1))
        yield* store.append(draft('ret_cursor', 'e2', T2))
        yield* store.append(draft('ret_cursor', 'e3', T3))
        yield* store.pruneBefore(T2)
        // The cursor points at e1's seq, which has since been pruned.
        const resumed = yield* store.readAfter('ret_cursor', e1.seq)
        return ids(resumed)
      }),
    )
    // No error, and the walk resumes at the oldest retained event.
    expect(result).toEqual(['event_ret_cursor_e2', 'event_ret_cursor_e3'])
  })

  it('deletes events strictly before the cutoff and keeps the boundary', async () => {
    const result = await run(
      Effect.gen(function* () {
        const store = yield* EventStore
        yield* store.append(draft('ret_boundary', 'before', T1))
        yield* store.append(draft('ret_boundary', 'at', T2)) // timestamp === cutoff
        yield* store.append(draft('ret_boundary', 'guard', T3)) // newest, not pruned
        const removed = yield* store.pruneBefore(T2)
        const retained = yield* store.readAfter('ret_boundary', 0)
        return { removed, retained: ids(retained) }
      }),
    )
    expect(result.removed).toBe(1)
    expect(result.retained).toEqual([
      'event_ret_boundary_at',
      'event_ret_boundary_guard',
    ])
  })

  it('preserves the seq high-water across a full-history prune', async () => {
    const result = await run(
      Effect.gen(function* () {
        const store = yield* EventStore
        yield* store.append(draft('ret_seq', 'e1', T1))
        yield* store.append(draft('ret_seq', 'e2', T2))
        const e3 = yield* store.append(draft('ret_seq', 'e3', T3))
        // Prune everything older than a far-future cutoff: only the newest row
        // (the seq watermark) survives.
        const removed = yield* store.pruneBefore(FUTURE)
        const e4 = yield* store.append(draft('ret_seq', 'e4', FUTURE))
        const retained = yield* store.readAfter('ret_seq', 0)
        return {
          removed,
          highWater: e3.seq,
          nextSeq: e4.seq,
          retained: ids(retained),
        }
      }),
    )
    expect(result.removed).toBe(2)
    // The new seq is strictly greater than the pre-prune max — never reused.
    expect(result.nextSeq).toBe(result.highWater + 1)
    expect(result.retained).toEqual(['event_ret_seq_e3', 'event_ret_seq_e4'])
  })
}

describe('event retention & replay — in-memory', () => {
  contract(InMemoryStorageLive)
})

describe('event retention & replay — sqlite', () => {
  contract(SqliteMemoryStorageLive)
})

// Runs only against a reachable Postgres; skipped in the hermetic unit suite.
const pgUrl = process.env.ACP_TEST_DATABASE_URL
describe.skipIf(pgUrl === undefined)(
  'event retention & replay — postgres',
  () => {
    contract(makePostgresStorageLive(pgUrl ?? 'postgresql://unused'))
  },
)
