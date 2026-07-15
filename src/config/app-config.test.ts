/** @Acp.Config.App.Test — defaults + env override */
import { describe, it, expect } from 'vitest'
import { ConfigProvider, Duration, Effect, Option } from 'effect'
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
    expect(cfg.eventBroker).toBe('in-process')
    expect(cfg.sqlitePath).toBe('acp.sqlite')
    expect(Duration.toMillis(cfg.defaultLeaseTtl)).toBe(15 * 60 * 1000)
    expect(cfg.eventRetentionDays).toBe(30)
    expect(cfg.maxArtifactSizeBytes).toBe(16 * 1024 * 1024)
    expect(cfg.requireAuth).toBe(false)
    expect(cfg.requireWorkspaceBindings).toBe(false)
    expect(cfg.profile).toBe('local')
    expect(cfg.sessionIssuer).toBe('trusted-client')
    expect(cfg.sessionIssuancePolicy).toEqual(Option.none())
  })

  it('applies the single-node profile preset (sqlite storage, auth on)', () => {
    const cfg = run([['ACP_PROFILE', 'single-node']])
    expect(cfg.storageAdapter).toBe('sqlite')
    expect(cfg.eventBroker).toBe('in-process')
    expect(cfg.requireAuth).toBe(true)
    expect(cfg.requireWorkspaceBindings).toBe(false)
    expect(cfg.sessionIssuer).toBe('trusted-client')
  })

  it('applies the local profile preset (memory storage, no auth)', () => {
    const cfg = run([['ACP_PROFILE', 'local']])
    expect(cfg.storageAdapter).toBe('memory')
    expect(cfg.eventBroker).toBe('in-process')
    expect(cfg.requireAuth).toBe(false)
    expect(cfg.requireWorkspaceBindings).toBe(false)
    expect(cfg.sessionIssuer).toBe('trusted-client')
  })

  it('applies hosted profile presets for multi-tenant deployments', () => {
    const cfg = run([['ACP_PROFILE', 'hosted']])
    expect(cfg.storageAdapter).toBe('postgres')
    expect(cfg.eventBroker).toBe('pg-notify')
    expect(cfg.requireAuth).toBe(true)
    expect(cfg.requireWorkspaceBindings).toBe(true)
    expect(cfg.sessionIssuer).toBe('static')
  })

  it('applies self-host-ha profile presets for replicated deployments', () => {
    const cfg = run([['ACP_PROFILE', 'self-host-ha']])
    expect(cfg.storageAdapter).toBe('postgres')
    expect(cfg.eventBroker).toBe('pg-notify')
    expect(cfg.requireAuth).toBe(true)
    expect(cfg.requireWorkspaceBindings).toBe(true)
    expect(cfg.sessionIssuer).toBe('trusted-client')
  })

  it('lets explicit variables override the profile preset', () => {
    const cfg = run([
      ['ACP_PROFILE', 'single-node'],
      ['ACP_STORAGE_ADAPTER', 'memory'],
      ['ACP_REQUIRE_AUTH', 'false'],
      ['ACP_REQUIRE_WORKSPACE_BINDINGS', 'true'],
    ])
    expect(cfg.storageAdapter).toBe('memory')
    expect(cfg.requireAuth).toBe(false)
    expect(cfg.requireWorkspaceBindings).toBe(true)
  })

  it('fails fast on an unsupported profile', () => {
    expect(() => run([['ACP_PROFILE', 'staging']])).toThrow()
  })

  it('does not allow explicit overrides to weaken hosted issuance', () => {
    const cfg = run([
      ['ACP_PROFILE', 'hosted'],
      ['ACP_REQUIRE_AUTH', 'false'],
      ['ACP_REQUIRE_WORKSPACE_BINDINGS', 'false'],
      ['ACP_SESSION_ISSUER', 'trusted-client'],
    ])
    expect(cfg.requireAuth).toBe(true)
    expect(cfg.requireWorkspaceBindings).toBe(true)
    expect(cfg.sessionIssuer).toBe('static')
  })

  it('rejects static issuance outside a complete auth boundary', () => {
    expect(() =>
      run([
        ['ACP_SESSION_ISSUER', 'static'],
        ['ACP_REQUIRE_AUTH', 'true'],
        ['ACP_REQUIRE_WORKSPACE_BINDINGS', 'false'],
      ]),
    ).toThrow('static session issuance requires')
  })

  it('preserves the opaque static policy for the issuer layer', () => {
    const policy = '{"issuer_id":"example"}'
    const cfg = run([['ACP_SESSION_ISSUANCE_POLICY', policy]])
    expect(cfg.sessionIssuancePolicy).toEqual(Option.some(policy))
  })

  it('reads overrides from the environment', () => {
    const cfg = run([
      ['ACP_PORT', '8080'],
      ['ACP_LOG_LEVEL', 'debug'],
      ['ACP_STORAGE_ADAPTER', 'sqlite'],
      ['ACP_EVENT_BROKER', 'pg-notify'],
      ['ACP_SQLITE_PATH', '/tmp/acp.sqlite'],
      ['ACP_SWEEP_INTERVAL', '250 millis'],
      ['ACP_MAX_ARTIFACT_SIZE_MB', '4'],
      ['ACP_REQUIRE_AUTH', 'true'],
      ['ACP_REQUIRE_WORKSPACE_BINDINGS', 'true'],
    ])
    expect(cfg.port).toBe(8080)
    expect(cfg.logLevel).toBe('debug')
    expect(cfg.storageAdapter).toBe('sqlite')
    expect(cfg.eventBroker).toBe('pg-notify')
    expect(cfg.sqlitePath).toBe('/tmp/acp.sqlite')
    expect(Duration.toMillis(cfg.sweepInterval)).toBe(250)
    expect(cfg.maxArtifactSizeBytes).toBe(4 * 1024 * 1024)
    expect(cfg.requireAuth).toBe(true)
    expect(cfg.requireWorkspaceBindings).toBe(true)
  })
})
