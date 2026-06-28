/** @Acp.App.Logging — Effect observability boundary */
import { Effect, Logger, LogLevel } from 'effect'
import { appLogLevelConfig, type AppLogLevel } from '../config/app-config.js'

export const toEffectLogLevel = (level: AppLogLevel): LogLevel.LogLevel => {
  switch (level) {
    case 'debug':
      return LogLevel.Debug
    case 'info':
      return LogLevel.Info
    case 'warn':
      return LogLevel.Warning
    case 'error':
      return LogLevel.Error
  }
}

export const withAcpJsonLogging =
  (component: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    Effect.flatMap(Effect.orDie(appLogLevelConfig), (level) =>
      effect.pipe(
        Effect.annotateLogs({ component, service: 'acp' }),
        Effect.withLogSpan(`acp.${component}`),
        Logger.withMinimumLogLevel(toEffectLogLevel(level)),
        Effect.provide(Logger.json),
      ),
    )
