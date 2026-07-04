/** @Acp.App.StorageLive — select the host storage adapter from config */
import { Effect, Layer, Option } from 'effect'
import { AppConfigTag } from '../config/app-config.js'
import {
  InMemoryStorageLive,
  makePostgresStorageLive,
  makeSqliteStorageLive,
} from '../infrastructure/storage/index.js'
import { StorageError } from '../protocol/errors/protocol-error.js'
import type { Storage } from '../infrastructure/storage/index.js'

export const StorageLive: Layer.Layer<Storage, StorageError, AppConfigTag> =
  Layer.unwrapEffect(
    Effect.gen(function* () {
      const config = yield* AppConfigTag
      if (config.storageAdapter === 'postgres') {
        return Option.match(config.databaseUrl, {
          onNone: () =>
            Layer.fail(
              new StorageError({
                op: 'connect',
                cause: 'ACP_DATABASE_URL is required for the postgres adapter',
              }),
            ),
          onSome: (url) => makePostgresStorageLive(url),
        })
      }
      return config.storageAdapter === 'sqlite'
        ? makeSqliteStorageLive(config.sqlitePath)
        : InMemoryStorageLive
    }),
  )
