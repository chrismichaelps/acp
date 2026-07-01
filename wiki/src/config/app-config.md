---
type: module
path: '@root/src/config/app-config.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
depth_score: 0.78
depth_status: DEEP
tags: [module, deep]
aliases: [app-config, AppConfig]
---

# App Config

## Purpose

Typed, defaulted configuration for every runtime knob (spec §16.5). Magic constants
are forbidden — each `ACP_*` env var has one `Config` definition with an explicit,
documented default, exposed as a single `AppConfig` value behind a Layer.

## Interface

### Signatures

```typescript
export type AppLogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface AppConfig {
  readonly port: number
  readonly logLevel: AppLogLevel
  readonly storageAdapter: 'memory' | 'sqlite'
  readonly sqlitePath: string
  readonly defaultLeaseTtl: Duration.Duration
  readonly eventRetentionDays: number
  readonly maxArtifactSizeBytes: number
  readonly sseHeartbeat: Duration.Duration
  readonly sessionTtl: Duration.Duration
  readonly sweepInterval: Duration.Duration
  readonly requireAuth: boolean
}
export class AppConfigTag extends Context.Tag('AppConfig')<
  AppConfigTag,
  AppConfig
>() {}
export const AppConfigLive: Layer.Layer<AppConfigTag>
```

## Algorithm

Each field is a `Config.*` with `Config.withDefault`:

- `ACP_PORT` int → 4317
- `ACP_LOG_LEVEL` literal → 'info' ([[app-logging]] maps it to Effect
  `LogLevel`)
- `ACP_STORAGE_ADAPTER` literal (`memory` | `sqlite`) → 'memory'
- `ACP_SQLITE_PATH` string → `acp.sqlite`
- `ACP_DEFAULT_LEASE_TTL` duration → 15 minutes
- `ACP_EVENT_RETENTION_DAYS` int → 30
- `ACP_MAX_ARTIFACT_SIZE_MB` int → 16 (stored as bytes)
- `ACP_SSE_HEARTBEAT` duration → 15 seconds
- `ACP_SESSION_TTL` duration → 1 hour (bearer-session lifetime; [[sweeper]] eviction)
- `ACP_SWEEP_INTERVAL` duration → 60 seconds ([[sweeper]] poll cadence)
- `ACP_REQUIRE_AUTH` boolean → false (when true, [[acp-router]] `authorize` rejects
  _unauthenticated_ mutations with `401` instead of degrading to `worker_system`)

The repository root `.env.example` is the drift-checked runtime manifest. It
mirrors these host variables, names the client-only `ACP_BASE_URL` /
`ACP_RPC_TOKEN` values used by [[cli-main]] and [[stdio-main]], and includes the
dogfood smoke metadata variables read by `scripts/`. Keep the example file
aligned with this page whenever runtime configuration changes, and keep bearer
tokens empty in committed examples.

`AppConfigLive = Layer.effect(AppConfigTag, Effect.orDie(<composed Config>))` —
invalid configuration is fatal at startup, so the `ConfigError` channel is
converted to a defect, giving `Layer.Layer<AppConfigTag>` (no error param).

## Negative Logic (Prohibited Paths)

- ❌ Do NOT hardcode a port, storage path, TTL, retention window, size limit, or heartbeat anywhere else.
- ❌ Do NOT read `process.env` directly — go through `Config`.
- ❌ Do NOT duplicate the log-level literal set outside [[app-config]] /
  [[app-logging]].

## Depth

DEEP (0.78). One typed surface hides all env parsing, defaulting, and validation;
deleting it scatters `process.env` reads and magic numbers across the codebase.

## Referenced by

[[lease.schema]] · [[sse-event-stream]] · [[app-logging]] ·
[[architecture/_MOC]] · [[src/_MOC]]
