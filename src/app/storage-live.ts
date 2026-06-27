/** @Acp.App.StorageLive — select the host storage adapter from config */
import { Effect, Layer } from 'effect'
import { AppConfigTag } from '../config/app-config.js'
import {
  InMemoryStorageLive,
  makeSqliteStorageLive,
} from '../infrastructure/storage/index.js'
import type { StorageError } from '../protocol/errors/protocol-error.js'
import type { Storage } from '../infrastructure/storage/index.js'

export const StorageLive: Layer.Layer<Storage, StorageError, AppConfigTag> =
  Layer.unwrapEffect(
    Effect.gen(function* () {
      const config = yield* AppConfigTag
      return config.storageAdapter === 'sqlite'
        ? makeSqliteStorageLive(config.sqlitePath)
        : InMemoryStorageLive
    }),
  )
