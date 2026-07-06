/** @Acp.Infra.Storage.Sqlite.QueryTest — indexed queryBy predicate reads */
import { describe, expect, it } from 'vitest'
import { Chunk, Effect } from 'effect'
import { SqliteMemoryStorageLive, Storage } from './index.js'

const run = <A, E>(program: Effect.Effect<A, E, Storage>): A =>
  Effect.runSync(Effect.provide(program, SqliteMemoryStorageLive))

describe('SQLite storage — queryBy indexed predicate read', () => {
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
    const rows = run(
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
    expect(rows).toEqual(['w1', 'w2'])
  })

  it('reflects the latest promoted columns after a value rewrite', () => {
    const rows = run(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* s.put('work', 'w1', {
          id: 'w1',
          workspace_id: 'a',
          state: 'open',
        })
        // Rewrite moves the row out of the (a, open) predicate.
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
    expect(rows.open).toBe(0)
    expect(rows.claimed).toEqual(['w1'])
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
})
