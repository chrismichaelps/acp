/** @Acp.App.Logging.Test — log-level mapping guard */
import { describe, expect, it } from 'vitest'
import { ConfigProvider, Effect, LogLevel } from 'effect'
import { appLogLevelConfig } from '../config/app-config.js'
import { toEffectLogLevel } from './logging.js'

const readLogLevel = (env: readonly (readonly [string, string])[]) =>
  Effect.runSync(
    appLogLevelConfig.pipe(
      Effect.withConfigProvider(ConfigProvider.fromMap(new Map(env))),
    ),
  )

describe('app logging', () => {
  it('maps ACP log levels to Effect runtime levels', () => {
    expect(toEffectLogLevel('debug')).toBe(LogLevel.Debug)
    expect(toEffectLogLevel('info')).toBe(LogLevel.Info)
    expect(toEffectLogLevel('warn')).toBe(LogLevel.Warning)
    expect(toEffectLogLevel('error')).toBe(LogLevel.Error)
  })

  it('uses info as the documented default log level', () => {
    expect(readLogLevel([])).toBe('info')
  })

  it('reads the configured log level from ACP_LOG_LEVEL', () => {
    expect(readLogLevel([['ACP_LOG_LEVEL', 'warn']])).toBe('warn')
  })
})
