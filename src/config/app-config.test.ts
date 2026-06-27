/** @Acp.Config.App.Test — defaults + env override */
import { describe, it, expect } from 'vitest'
import { ConfigProvider, Duration, Effect } from 'effect'
import { AppConfigTag, AppConfigLive } from './app-config.js'

const run = (env: readonly (readonly [string, string])[]) =>
  Effect.runSync(
    Effect.provide(AppConfigTag, AppConfigLive).pipe(
      Effect.withConfigProvider(ConfigProvider.fromMap(new Map(env))),
    ),
  )

describe('AppConfig', () => {
  it('applies documented defaults when env is empty', () => {
    const cfg = run([])
    expect(cfg.port).toBe(4317)
    expect(cfg.logLevel).toBe('info')
    expect(Duration.toMillis(cfg.defaultLeaseTtl)).toBe(15 * 60 * 1000)
    expect(cfg.eventRetentionDays).toBe(30)
    expect(cfg.maxArtifactSizeBytes).toBe(16 * 1024 * 1024)
    expect(cfg.requireAuth).toBe(false)
  })

  it('reads overrides from the environment', () => {
    const cfg = run([
      ['ACP_PORT', '8080'],
      ['ACP_LOG_LEVEL', 'debug'],
      ['ACP_MAX_ARTIFACT_SIZE_MB', '4'],
      ['ACP_REQUIRE_AUTH', 'true'],
    ])
    expect(cfg.port).toBe(8080)
    expect(cfg.logLevel).toBe('debug')
    expect(cfg.maxArtifactSizeBytes).toBe(4 * 1024 * 1024)
    expect(cfg.requireAuth).toBe(true)
  })
})
