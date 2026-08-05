/** @Acp.Infra.Storage.QueryConformance — queryBy + version-CAS parity across adapters */
import { describe, expect, it } from 'vitest'
import { Chunk, Effect, Option, Schema } from 'effect'
import type { Layer } from 'effect'
import type { StorageError } from '../../protocol/errors/protocol-error.js'
import { Event } from '../../protocol/schema/index.js'
import type { EventDraft } from './index.js'
import {
  InMemoryStorageLive,
  SqliteMemoryStorageLive,
  Storage,
} from './index.js'

// One suite run identically against each adapter, so any divergence in queryBy
// ordering/limit/predicate semantics or version-CAS behaviour surfaces as a
// failure rather than as a silent behaviour split between the local and durable
// paths. Postgres carries its own connection-guarded store test; here we stay
// driver-free and cover the two in-process adapters.
const adapters: readonly (readonly [
  string,
  Layer.Layer<Storage, StorageError>,
])[] = [
  ['in-memory', InMemoryStorageLive],
  ['sqlite', SqliteMemoryStorageLive],
]

/** Builds a branded EventDraft; Storage assigns `seq` on append. */
const eventDraft = (workspace: string, n: number): EventDraft => {
  const full = Schema.decodeUnknownSync(Event)({
    id: `event_${workspace}_${String(n)}`,
    type: 'work.created',
    workspace_id: workspace,
    actor: 'agent_claude_code',
    timestamp: '2026-08-04T10:00:00Z',
    seq: 0,
    data: { n: String(n) },
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

describe.each(adapters)('storage conformance — %s', (_name, layer) => {
  const run = <A, E>(program: Effect.Effect<A, E, Storage>): A =>
    Effect.runSync(Effect.provide(program, layer))

  // parent_id is the spawn-graph scoping column added by
  // [[ADR-0021-work-unit-spawn-graph]]. SQLite adds it as a plain column filled
  // on write; Postgres derives it as a generated column. Both must answer the
  // same child query, and both must treat a parentless row as unmatched rather
  // than as a child of anything.
  it('filters children by parent_id, ordered by id', () => {
    const rows = run(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* s.put('work', 'c2', {
          id: 'c2',
          workspace_id: 'a',
          parent_id: 'p1',
        })
        yield* s.put('work', 'c1', {
          id: 'c1',
          workspace_id: 'a',
          parent_id: 'p1',
        })
        yield* s.put('work', 'c3', {
          id: 'c3',
          workspace_id: 'a',
          parent_id: 'p2',
        })
        yield* s.put('work', 'root', { id: 'root', workspace_id: 'a' })
        yield* s.put('work', 'nulled', {
          id: 'nulled',
          workspace_id: 'a',
          parent_id: null,
        })
        const children = yield* s.queryBy('work', [
          { field: 'parent_id', value: 'p1' },
        ])
        return Chunk.toReadonlyArray(children).map(
          (row) => (row as { id: string }).id,
        )
      }),
    )
    expect(rows).toEqual(['c1', 'c2'])
  })

  it('returns no children for a parent that has none', () => {
    const rows = run(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* s.put('work', 'c1', {
          id: 'c1',
          workspace_id: 'a',
          parent_id: 'p1',
        })
        const children = yield* s.queryBy('work', [
          { field: 'parent_id', value: 'p_absent' },
        ])
        return Chunk.toReadonlyArray(children)
      }),
    )
    expect(rows).toEqual([])
  })

  it('combines parent_id with other filters', () => {
    const rows = run(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* s.put('work', 'c1', {
          id: 'c1',
          workspace_id: 'a',
          parent_id: 'p1',
          state: 'open',
        })
        yield* s.put('work', 'c2', {
          id: 'c2',
          workspace_id: 'a',
          parent_id: 'p1',
          state: 'completed',
        })
        const openChildren = yield* s.queryBy('work', [
          { field: 'parent_id', value: 'p1' },
          { field: 'state', value: 'open' },
        ])
        return Chunk.toReadonlyArray(openChildren).map(
          (row) => (row as { id: string }).id,
        )
      }),
    )
    expect(rows).toEqual(['c1'])
  })

  // Tail reads answer "the last N events", which `readEventsAfter` can only do
  // by scanning from seq 0 — see [[ADR-0025-event-tail-reads]]. The contract is
  // deliberately ascending on return even though the query runs descending, so
  // every existing Event consumer keeps its one ordering assumption.
  const seedEvents = (count: number, workspace = 'ws_a') =>
    Effect.gen(function* () {
      const s = yield* Storage
      for (let n = 1; n <= count; n += 1) {
        yield* s.appendEvent(workspace, eventDraft(workspace, n))
      }
    })

  const seqsOf = (chunk: Chunk.Chunk<{ readonly seq: number }>) =>
    Chunk.toReadonlyArray(chunk).map((event) => event.seq)

  it('returns the newest events in ascending seq order', () => {
    const seqs = run(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* seedEvents(5)
        return seqsOf(yield* s.readEventsTail('ws_a', 3))
      }),
    )
    expect(seqs).toEqual([3, 4, 5])
  })

  it('returns everything when the log holds fewer events than the limit', () => {
    const seqs = run(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* seedEvents(2)
        return seqsOf(yield* s.readEventsTail('ws_a', 10))
      }),
    )
    expect(seqs).toEqual([1, 2])
  })

  it('is empty for a workspace with no events', () => {
    const events = run(
      Effect.flatMap(Storage, (s) => s.readEventsTail('ws_unknown', 5)),
    )
    expect(Chunk.toReadonlyArray(events)).toEqual([])
  })

  it('never crosses workspace boundaries', () => {
    const seqs = run(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* seedEvents(3, 'ws_a')
        yield* seedEvents(3, 'ws_b')
        const tail = yield* s.readEventsTail('ws_b', 10)
        return Chunk.toReadonlyArray(tail).map((e) => e.workspace_id)
      }),
    )
    expect(new Set(seqs)).toEqual(new Set(['ws_b']))
  })

  it('agrees with readEventsAfter over the overlapping range', () => {
    const both = run(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* seedEvents(5)
        const tail = yield* s.readEventsTail('ws_a', 2)
        const after = yield* s.readEventsAfter('ws_a', 3, Option.none())
        return { tail: seqsOf(tail), after: seqsOf(after) }
      }),
    )
    expect(both.tail).toEqual(both.after)
  })

  it('returns only rows matching every filter, ordered by id', () => {
    const rows = run(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* s.put('work', 'w2', {
          id: 'w2',
          workspace_id: 'a',
          state: 'open',
        })
        yield* s.put('work', 'w1', {
          id: 'w1',
          workspace_id: 'a',
          state: 'open',
        })
        yield* s.put('work', 'w3', {
          id: 'w3',
          workspace_id: 'a',
          state: 'claimed',
        })
        yield* s.put('work', 'w4', {
          id: 'w4',
          workspace_id: 'b',
          state: 'open',
        })
        const openInA = yield* s.queryBy('work', [
          { field: 'workspace_id', value: 'a' },
          { field: 'state', value: 'open' },
        ])
        return Chunk.toReadonlyArray(openInA)
      }),
    )
    expect(rows).toEqual([
      { id: 'w1', workspace_id: 'a', state: 'open' },
      { id: 'w2', workspace_id: 'a', state: 'open' },
    ])
  })

  it('honors the limit option after ordering by id', () => {
    const ids = run(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* s.put('work', 'w3', { id: 'w3', workspace_id: 'a' })
        yield* s.put('work', 'w1', { id: 'w1', workspace_id: 'a' })
        yield* s.put('work', 'w2', { id: 'w2', workspace_id: 'a' })
        const first = yield* s.queryBy(
          'work',
          [{ field: 'workspace_id', value: 'a' }],
          { limit: 2 },
        )
        return Chunk.toReadonlyArray(first).map((r) => (r as { id: string }).id)
      }),
    )
    expect(ids).toEqual(['w1', 'w2'])
  })

  it('reflects the latest promoted columns after a value rewrite', () => {
    const result = run(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* s.put('work', 'w1', {
          id: 'w1',
          workspace_id: 'a',
          state: 'open',
        })
        yield* s.put('work', 'w1', {
          id: 'w1',
          workspace_id: 'a',
          state: 'claimed',
        })
        const stillOpen = yield* s.queryBy('work', [
          { field: 'workspace_id', value: 'a' },
          { field: 'state', value: 'open' },
        ])
        const nowClaimed = yield* s.queryBy('work', [
          { field: 'workspace_id', value: 'a' },
          { field: 'state', value: 'claimed' },
        ])
        return {
          open: Chunk.size(stillOpen),
          claimed: Chunk.toReadonlyArray(nowClaimed).map(
            (r) => (r as { id: string }).id,
          ),
        }
      }),
    )
    expect(result.open).toBe(0)
    expect(result.claimed).toEqual(['w1'])
  })

  it('rejects an unknown filter field with a StorageError', () => {
    const result = run(
      Effect.gen(function* () {
        const s = yield* Storage
        return yield* Effect.either(
          s.queryBy('work', [{ field: 'nope', value: 'x' }]),
        )
      }),
    )
    expect(result._tag).toBe('Left')
  })

  it('an empty filter set returns every row in the collection, ordered by id', () => {
    const ids = run(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* s.put('work', 'w2', { id: 'w2', workspace_id: 'a' })
        yield* s.put('work', 'w1', { id: 'w1', workspace_id: 'b' })
        const all = yield* s.queryBy('work', [])
        return Chunk.toReadonlyArray(all).map((r) => (r as { id: string }).id)
      }),
    )
    expect(ids).toEqual(['w1', 'w2'])
  })

  it('swaps only when the expected version matches (version CAS)', () => {
    const outcome = run(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* s.put('work', 'w1', { id: 'w1', state: 'open' })
        const initial = yield* s.getVersioned('work', 'w1')
        const version = Option.getOrThrow(initial).version

        // Stale expectation → rejected, value + version unchanged.
        const stale = yield* s.replaceIfVersion('work', 'w1', version - 1, {
          id: 'w1',
          state: 'stale',
        })
        // Current expectation → accepted, version increments by one.
        const fresh = yield* s.replaceIfVersion('work', 'w1', version, {
          id: 'w1',
          state: 'claimed',
        })
        const after = yield* s.getVersioned('work', 'w1')
        const rec = Option.getOrThrow(after)
        return {
          stale,
          fresh,
          value: rec.value,
          bumped: rec.version === version + 1,
        }
      }),
    )
    expect(outcome.stale).toBe(false)
    expect(outcome.fresh).toBe(true)
    expect(outcome.value).toEqual({ id: 'w1', state: 'claimed' })
    expect(outcome.bumped).toBe(true)
  })
})
