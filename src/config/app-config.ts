/** @Acp.Config.App — typed, defaulted runtime configuration */
import { Config, Context, Duration, Effect, Layer } from 'effect'

export interface AppConfig {
  readonly port: number
  readonly logLevel: 'debug' | 'info' | 'warn' | 'error'
  readonly defaultLeaseTtl: Duration.Duration
  readonly eventRetentionDays: number
  readonly maxArtifactSizeBytes: number
  readonly sseHeartbeat: Duration.Duration
  readonly sessionTtl: Duration.Duration
  readonly sweepInterval: Duration.Duration
}

export class AppConfigTag extends Context.Tag('AppConfig')<
  AppConfigTag,
  AppConfig
>() {}

const load = Effect.gen(function* () {
  const port = yield* Config.integer('ACP_PORT').pipe(Config.withDefault(4317))
  const logLevel = yield* Config.literal(
    'debug',
    'info',
    'warn',
    'error',
  )('ACP_LOG_LEVEL').pipe(Config.withDefault('info' as const))
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
  return {
    port,
    logLevel,
    defaultLeaseTtl,
    eventRetentionDays,
    maxArtifactSizeBytes: maxArtifactSizeMb * 1024 * 1024,
    sseHeartbeat,
    sessionTtl,
    sweepInterval,
  }
})

// Invalid configuration is fatal at startup → convert ConfigError to a defect.
export const AppConfigLive: Layer.Layer<AppConfigTag> = Layer.effect(
  AppConfigTag,
  Effect.orDie(load),
)
