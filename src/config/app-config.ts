/** @Acp.Config.App — typed, defaulted runtime configuration */
import { Config, Context, Duration, Effect, Layer, Option } from 'effect'

export type AppLogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface AppConfig {
  readonly port: number
  readonly logLevel: AppLogLevel
  readonly storageAdapter: 'memory' | 'sqlite' | 'postgres'
  readonly eventBroker: 'in-process' | 'pg-notify'
  readonly sqlitePath: string
  readonly databaseUrl: Option.Option<string>
  readonly defaultLeaseTtl: Duration.Duration
  readonly eventRetentionDays: number
  readonly maxArtifactSizeBytes: number
  readonly sseHeartbeat: Duration.Duration
  readonly sessionTtl: Duration.Duration
  readonly sweepInterval: Duration.Duration
  readonly requireAuth: boolean
  readonly requireWorkspaceBindings: boolean
}

export const appLogLevelConfig: Config.Config<AppLogLevel> = Config.literal(
  'debug',
  'info',
  'warn',
  'error',
)('ACP_LOG_LEVEL').pipe(Config.withDefault('info' as const))

export class AppConfigTag extends Context.Tag('AppConfig')<
  AppConfigTag,
  AppConfig
>() {}

type AppProfile = 'local' | 'single-node' | 'hosted' | 'self-host-ha'

// A deployment profile (ACP_PROFILE) is a one-variable preset over the
// individual knobs — see [[ADR-0008-deployment-storage-topology]]. Explicit
// ACP_* variables still override profile defaults for self-hosting, but hosted
// profile defaults keep auth and workspace-bound sessions on.
const profileDefaults = (profile: Option.Option<AppProfile>) => {
  switch (Option.getOrElse(profile, () => 'local' as const)) {
    case 'single-node':
      return {
        storageAdapter: 'sqlite' as const,
        eventBroker: 'in-process' as const,
        requireAuth: true,
        requireWorkspaceBindings: false,
      }
    case 'hosted':
    case 'self-host-ha':
      return {
        storageAdapter: 'postgres' as const,
        eventBroker: 'pg-notify' as const,
        requireAuth: true,
        requireWorkspaceBindings: true,
      }
    case 'local':
      return {
        storageAdapter: 'memory' as const,
        eventBroker: 'in-process' as const,
        requireAuth: false,
        requireWorkspaceBindings: false,
      }
  }
}

const load = Effect.gen(function* () {
  const port = yield* Config.integer('ACP_PORT').pipe(Config.withDefault(4317))
  const logLevel = yield* appLogLevelConfig
  const profile = yield* Config.literal(
    'local',
    'single-node',
    'hosted',
    'self-host-ha',
  )('ACP_PROFILE').pipe(Config.option)
  const defaults = profileDefaults(profile)
  const storageAdapter = yield* Config.literal(
    'memory',
    'sqlite',
    'postgres',
  )('ACP_STORAGE_ADAPTER').pipe(Config.withDefault(defaults.storageAdapter))
  const eventBroker = yield* Config.literal(
    'in-process',
    'pg-notify',
  )('ACP_EVENT_BROKER').pipe(Config.withDefault(defaults.eventBroker))
  const sqlitePath = yield* Config.string('ACP_SQLITE_PATH').pipe(
    Config.withDefault('acp.sqlite'),
  )
  const databaseUrl = yield* Config.string('ACP_DATABASE_URL').pipe(
    Config.option,
  )
  const defaultLeaseTtl = yield* Config.duration('ACP_DEFAULT_LEASE_TTL').pipe(
    Config.withDefault(Duration.minutes(15)),
  )
  const eventRetentionDays = yield* Config.integer(
    'ACP_EVENT_RETENTION_DAYS',
  ).pipe(Config.withDefault(30))
  const maxArtifactSizeMb = yield* Config.integer(
    'ACP_MAX_ARTIFACT_SIZE_MB',
  ).pipe(Config.withDefault(16))
  const sseHeartbeat = yield* Config.duration('ACP_SSE_HEARTBEAT').pipe(
    Config.withDefault(Duration.seconds(15)),
  )
  const sessionTtl = yield* Config.duration('ACP_SESSION_TTL').pipe(
    Config.withDefault(Duration.hours(1)),
  )
  const sweepInterval = yield* Config.duration('ACP_SWEEP_INTERVAL').pipe(
    Config.withDefault(Duration.seconds(60)),
  )
  const requireAuth = yield* Config.boolean('ACP_REQUIRE_AUTH').pipe(
    Config.withDefault(defaults.requireAuth),
  )
  const requireWorkspaceBindings = yield* Config.boolean(
    'ACP_REQUIRE_WORKSPACE_BINDINGS',
  ).pipe(Config.withDefault(defaults.requireWorkspaceBindings))
  return {
    port,
    logLevel,
    storageAdapter,
    eventBroker,
    sqlitePath,
    databaseUrl,
    defaultLeaseTtl,
    eventRetentionDays,
    maxArtifactSizeBytes: maxArtifactSizeMb * 1024 * 1024,
    sseHeartbeat,
    sessionTtl,
    sweepInterval,
    requireAuth,
    requireWorkspaceBindings,
  }
})

// Invalid configuration is fatal at startup → convert ConfigError to a defect.
export const AppConfigLive: Layer.Layer<AppConfigTag> = Layer.effect(
  AppConfigTag,
  Effect.orDie(load),
)
