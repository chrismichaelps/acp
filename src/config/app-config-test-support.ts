/** @Acp.Config.App.TestSupport — AppConfig literals for tests */
import { Duration, Layer, Option } from 'effect'
import { AppConfigTag } from './app-config.js'
import type { AppConfig } from './app-config.js'

/**
 * A complete `AppConfig` with local-profile defaults, so a test that cares
 * about one knob does not have to restate the other eighteen. Adding a field to
 * `AppConfig` requires a default here and nowhere else in the test suite.
 */
export const testAppConfig = (
  overrides: Partial<AppConfig> = {},
): AppConfig => ({
  profile: 'local',
  port: 4317,
  logLevel: 'info',
  storageAdapter: 'memory',
  eventBroker: 'in-process',
  sqlitePath: 'acp.sqlite',
  databaseUrl: Option.none(),
  defaultLeaseTtl: Duration.minutes(15),
  eventRetentionDays: 30,
  maxWorkDepth: 10,
  policyFile: Option.none(),
  maxArtifactSizeBytes: 16 * 1024 * 1024,
  sseHeartbeat: Duration.seconds(15),
  sessionTtl: Duration.hours(1),
  sweepInterval: Duration.seconds(60),
  requireAuth: false,
  requireWorkspaceBindings: false,
  sessionIssuer: 'trusted-client',
  sessionIssuancePolicy: Option.none(),
  metricsToken: Option.none(),
  ...overrides,
})

/** `testAppConfig` as a ready-to-merge layer. */
export const TestAppConfigLive = (
  overrides: Partial<AppConfig> = {},
): Layer.Layer<AppConfigTag> =>
  Layer.succeed(AppConfigTag, testAppConfig(overrides))
