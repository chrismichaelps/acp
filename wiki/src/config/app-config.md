---
type: module
path: "@root/src/config/app-config.ts"
fidelity: Active
grammar: "[[grammar/typescript]]"
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
export interface AppConfig {
  readonly port: number
  readonly logLevel: 'debug' | 'info' | 'warn' | 'error'
  readonly defaultLeaseTtl: Duration.Duration
  readonly eventRetentionDays: number
  readonly maxArtifactSizeBytes: number
  readonly sseHeartbeat: Duration.Duration
}
export class AppConfigTag extends Context.Tag('AppConfig')<AppConfigTag, AppConfig>() {}
export const AppConfigLive: Layer.Layer<AppConfigTag>
```

## Algorithm
Each field is a `Config.*` with `Config.withDefault`:
- `ACP_PORT` int → 4317
- `ACP_LOG_LEVEL` literal → 'info'
- `ACP_DEFAULT_LEASE_TTL` duration → 15 minutes
- `ACP_EVENT_RETENTION_DAYS` int → 30
- `ACP_MAX_ARTIFACT_SIZE_MB` int → 16 (stored as bytes)
- `ACP_SSE_HEARTBEAT` duration → 15 seconds
`AppConfigLive = Layer.effect(AppConfigTag, Effect.orDie(<composed Config>))` —
invalid configuration is fatal at startup, so the `ConfigError` channel is
converted to a defect, giving `Layer.Layer<AppConfigTag>` (no error param).

## Negative Logic (Prohibited Paths)
- ❌ Do NOT hardcode a port, TTL, retention window, size limit, or heartbeat anywhere else.
- ❌ Do NOT read `process.env` directly — go through `Config`.

## Depth
DEEP (0.78). One typed surface hides all env parsing, defaulting, and validation;
deleting it scatters `process.env` reads and magic numbers across the codebase.

## Referenced by
[[lease.schema]] · [[architecture/_MOC]] · [[src/_MOC]]
