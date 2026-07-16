/** @Acp.App.Server.StoreVersionGuard.Test — cross-adapter startup-guard conformance */
import { describe, expect, it } from 'vitest'
import { Effect, Option } from 'effect'
import type { Layer } from 'effect'
import type { StorageError } from '../../protocol/errors/protocol-error.js'
import {
  InMemoryStorageLive,
  SqliteMemoryStorageLive,
  Storage,
} from '../../infrastructure/storage/index.js'
import { ACP_PROTOCOL_VERSION } from '../../protocol/version.js'
import { checkStoreVersion } from './store-version-guard.js'

const META_COLLECTION = 'store_meta'
const META_ID = 'protocol_version'

const adapters: readonly (readonly [
  string,
  Layer.Layer<Storage, StorageError>,
])[] = [
  ['in-memory', InMemoryStorageLive],
  ['sqlite', SqliteMemoryStorageLive],
]

describe.each(adapters)('store version guard — %s', (_name, storageLayer) => {
  it('stamps the current version on a fresh store', () =>
    Effect.gen(function* () {
      yield* checkStoreVersion
      const stored = yield* (yield* Storage).get(META_COLLECTION, META_ID)
      expect(Option.getOrNull(stored)).toEqual({
        version: ACP_PROTOCOL_VERSION,
      })
    }).pipe(Effect.provide(storageLayer), Effect.runPromise))

  it('boots when the stamp is the current supported version', () =>
    Effect.gen(function* () {
      const storage = yield* Storage
      yield* storage.putIfAbsent(META_COLLECTION, META_ID, {
        version: ACP_PROTOCOL_VERSION,
      })
      yield* checkStoreVersion // must not throw
    }).pipe(Effect.provide(storageLayer), Effect.runPromise))

  it('fails closed when the stamp is an unsupported version', () =>
    Effect.gen(function* () {
      const storage = yield* Storage
      yield* storage.putIfAbsent(META_COLLECTION, META_ID, {
        version: '9.9',
      })
      const exit = yield* Effect.exit(checkStoreVersion)
      expect(exit._tag).toBe('Failure')
    }).pipe(Effect.provide(storageLayer), Effect.runPromise))
})
