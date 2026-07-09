/** @Acp.Infra.Storage.QueryConformance — queryBy + version-CAS parity across adapters */
import { describe, expect, it } from 'vitest'
import { Chunk, Effect, Option } from 'effect'
import type { Layer } from 'effect'
import type { StorageError } from '../../protocol/errors/protocol-error.js'
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

describe.each(adapters)('storage conformance — %s', (_name, layer) => {
  const run = <A, E>(program: Effect.Effect<A, E, Storage>): A =>
    Effect.runSync(Effect.provide(program, layer))

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
