/** @Acp.App.Server.StoreVersionGuard — fail-closed protocol-version boot check */
import { Effect, Layer, Option } from 'effect'
import { Storage } from '../../infrastructure/storage/storage.js'
import { IncompatibleStoreVersionError } from '../../protocol/errors/protocol-error.js'
import type { StorageError } from '../../protocol/errors/protocol-error.js'
import {
  ACP_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
} from '../../protocol/version.js'

const META_COLLECTION = 'store_meta'
const META_ID = 'protocol_version'

interface StoreMeta {
  readonly version: string
}

const isSupported = (v: string): boolean =>
  (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(v)

/**
 * Read the store's persisted protocol stamp. Absent → this is a fresh store, so
 * stamp the running version and proceed. Present and supported → proceed.
 * Present and unsupported → fail closed; ACP will not serve against a store it
 * cannot interpret. There is no automatic cross-version migration.
 */
export const checkStoreVersion: Effect.Effect<
  void,
  StorageError | IncompatibleStoreVersionError,
  Storage
> = Effect.gen(function* () {
  const storage = yield* Storage
  const existing = yield* storage.get(META_COLLECTION, META_ID)
  if (Option.isNone(existing)) {
    yield* storage.putIfAbsent(META_COLLECTION, META_ID, {
      version: ACP_PROTOCOL_VERSION,
    })
    return
  }
  const stored = (existing.value as StoreMeta).version
  if (!isSupported(stored)) {
    return yield* Effect.fail(
      new IncompatibleStoreVersionError({
        stored,
        supported: SUPPORTED_PROTOCOL_VERSIONS,
      }),
    )
  }
})

export const StoreVersionGuardLive: Layer.Layer<
  never,
  StorageError | IncompatibleStoreVersionError,
  Storage
> = Layer.effectDiscard(checkStoreVersion)
