/** @Acp.Infra.Storage.CasContention.Test — lost CAS swaps are counted */
import { describe, expect, it } from 'vitest'
import type { Layer } from 'effect'
import { Effect } from 'effect'
import { renderPrometheus } from '../metrics/index.js'
import {
  InMemoryStorageLive,
  SqliteMemoryStorageLive,
  Storage,
} from './index.js'
import type { StorageError } from '../../protocol/errors/protocol-error.js'

const adapters: readonly (readonly [
  string,
  Layer.Layer<Storage, StorageError>,
])[] = [
  ['in-memory', InMemoryStorageLive],
  ['sqlite', SqliteMemoryStorageLive],
]

/** Reads the counter line for one collection out of the rendered scrape. */
const casTotalFor = async (collection: string): Promise<number> => {
  const out = await Effect.runPromise(renderPrometheus)
  const line = out
    .split('\n')
    .find(
      (l) =>
        l.startsWith('acp_storage_cas_conflicts_total') &&
        l.includes(`collection="${collection}"`),
    )
  return line === undefined ? 0 : Number(line.split(' ').pop())
}

describe.each(adapters)('CAS contention counter — %s', (name, layer) => {
  const collection = `cas_${name.replace('-', '_')}`

  it('counts a lost CAS swap and leaves the row untouched', async () => {
    const before = await casTotalFor(collection)

    const result = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const s = yield* Storage
          yield* s.put(collection, 'row', { id: 'row', v: 1 })
          const stored = yield* s.getVersioned(collection, 'row')
          const version =
            stored._tag === 'Some' ? stored.value.version : Number.NaN
          // A stale expected version loses the swap.
          const lost = yield* s.replaceIfVersion(
            collection,
            'row',
            version + 5,
            {
              id: 'row',
              v: 99,
            },
          )
          const won = yield* s.replaceIfVersion(collection, 'row', version, {
            id: 'row',
            v: 2,
          })
          return { lost, won }
        }),
        layer,
      ),
    )

    expect(result.lost).toBe(false)
    expect(result.won).toBe(true)
    // Exactly one swap was lost, so the counter advanced by exactly one.
    expect(await casTotalFor(collection)).toBe(before + 1)
  })
})
