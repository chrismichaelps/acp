/** @Acp.App.EventBrokerLive — select event fan-out adapter from config */
import { Effect, Layer, Option } from 'effect'
import { AppConfigTag, type AppConfig } from '../config/app-config.js'
import { InProcessEventBrokerLive } from '../domain/events/index.js'
import type { EventBroker } from '../domain/events/index.js'
import { makePgNotifyEventBrokerLive } from '../infrastructure/events/index.js'
import type { Storage } from '../infrastructure/storage/index.js'
import { StorageError } from '../protocol/errors/protocol-error.js'

export const EventBrokerLive: Layer.Layer<
  EventBroker,
  StorageError,
  AppConfigTag | Storage
> = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config: AppConfig = yield* AppConfigTag
    if (config.eventBroker === 'pg-notify') {
      return Option.match(config.databaseUrl, {
        onNone: () =>
          Layer.fail(
            new StorageError({
              op: 'connect',
              cause: 'ACP_DATABASE_URL is required for the pg-notify broker',
            }),
          ),
        onSome: (url) => makePgNotifyEventBrokerLive(url),
      })
    }
    return InProcessEventBrokerLive
  }),
)
