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
    expect(cfg.storageAdapter).toBe('memory')
    expect(cfg.sqlitePath).toBe('acp.sqlite')
    expect(Duration.toMillis(cfg.defaultLeaseTtl)).toBe(15 * 60 * 1000)
    expect(cfg.eventRetentionDays).toBe(30)
    expect(cfg.maxArtifactSizeBytes).toBe(16 * 1024 * 1024)
    expect(cfg.requireAuth).toBe(false)
  })

  it('applies the single-node profile preset (sqlite storage, auth on)', () => {
    const cfg = run([['ACP_PROFILE', 'single-node']])
    expect(cfg.storageAdapter).toBe('sqlite')
    expect(cfg.requireAuth).toBe(true)
  })

  it('applies the local profile preset (memory storage, no auth)', () => {
    const cfg = run([['ACP_PROFILE', 'local']])
    expect(cfg.storageAdapter).toBe('memory')
    expect(cfg.requireAuth).toBe(false)
  })

  it('lets explicit variables override the profile preset', () => {
    const cfg = run([
      ['ACP_PROFILE', 'single-node'],
      ['ACP_STORAGE_ADAPTER', 'memory'],
      ['ACP_REQUIRE_AUTH', 'false'],
    ])
    expect(cfg.storageAdapter).toBe('memory')
    expect(cfg.requireAuth).toBe(false)
  })

  it('fails fast on an unsupported profile', () => {
    expect(() => run([['ACP_PROFILE', 'hosted']])).toThrow()
  })

  it('reads overrides from the environment', () => {
    const cfg = run([
      ['ACP_PORT', '8080'],
      ['ACP_LOG_LEVEL', 'debug'],
      ['ACP_STORAGE_ADAPTER', 'sqlite'],
      ['ACP_SQLITE_PATH', '/tmp/acp.sqlite'],
      ['ACP_MAX_ARTIFACT_SIZE_MB', '4'],
      ['ACP_REQUIRE_AUTH', 'true'],
    ])
    expect(cfg.port).toBe(8080)
    expect(cfg.logLevel).toBe('debug')
    expect(cfg.storageAdapter).toBe('sqlite')
    expect(cfg.sqlitePath).toBe('/tmp/acp.sqlite')
    expect(cfg.maxArtifactSizeBytes).toBe(4 * 1024 * 1024)
    expect(cfg.requireAuth).toBe(true)
  })
})
