---
type: module
path: '@root/src/app/logging.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.7
depth_status: DEEP
tags: [module, observability, deep]
aliases: [app-logging, logging]
---

# App Logging

## Purpose

Provide the ACP runtime logging boundary for Effect programs. The module maps the
documented `ACP_LOG_LEVEL` config value to Effect `LogLevel`, installs Effect's
structured JSON logger for server processes, and adds stable `service` and
`component` annotations plus an `acp.<component>` span to every log emitted by
the wrapped workflow.

The first consumer is [[server-main]]. CLI and stdio entrypoints are intentionally
excluded because their stdout is user/protocol output; attaching a JSON stdout
logger there would corrupt command output and Content-Length frames.

## Interface

### Signatures

```typescript
export const appLogLevelConfig: Config.Config<AppLogLevel>
export const toEffectLogLevel: (level: AppLogLevel) => LogLevel.LogLevel
export const withAcpJsonLogging: (
  component: string,
) => <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
```

### Linkage

- **Requires:** [[app-config]] (`AppLogLevel`), Effect `Config`, `Effect`,
  `Logger`, and `LogLevel`.
- **Consumed by:** [[server-main]].

## Algorithm

`appLogLevelConfig` reads `ACP_LOG_LEVEL` with the same literal set and default as
[[app-config]]. `toEffectLogLevel` translates the ACP strings to Effect runtime
levels: `debug → LogLevel.Debug`, `info → LogLevel.Info`,
`warn → LogLevel.Warning`, and `error → LogLevel.Error`.

`withAcpJsonLogging(component)` reads the configured level, wraps the supplied
workflow in `Logger.withMinimumLogLevel`, provides Effect's `Logger.json`, and
adds `service=acp` and `component=<component>` annotations plus an
`acp.<component>` span. Invalid log-level configuration is fatal at startup,
matching [[app-config]]'s fail-fast configuration policy. The wrapper does not
log secrets, bearer tokens, request bodies, artifact content, or raw error
internals.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT configure stdout JSON logging for [[cli-main]] or [[stdio-main]].
- ❌ Do NOT log authorization tokens, artifact content, request bodies, or SQLite
  paths that may contain local machine details.
- ❌ Do NOT invent a custom logger until Effect's built-in JSON/logfmt layers stop
  meeting operator needs.

## Depth

DEEP (0.7). One tiny API hides Effect logger setup, level translation, and
annotation policy. Deleting it would scatter log-level switches and logger
providers across entrypoints.

## Grill Log

- **Q:** Should logging be a custom service seam or use Effect's built-in logger
  context directly?
  **A:** Use Effect's built-in logger context. _Rationale:_ the current need is
  runtime formatting, log-level filtering, annotations, and spans; Effect already
  provides those as first-class primitives. _Rejected:_ a bespoke `LoggerService`
  that would wrap Effect without adding behavior.
- **Q:** JSON or logfmt for the server process?
  **A:** JSON. _Rationale:_ ACP is a host/coordination service; JSON preserves
  annotations and spans for log aggregation, CI artifacts, and future hosted
  deployments. _Rejected:_ logfmt as the default (pleasant locally but less
  lossless for downstream processors).
- **Q:** Should the CLI and stdio binaries use the same logger wrapper?
  **A:** No. _Rationale:_ both use stdout as part of their contract; log lines
  would break shell JSON consumers and stdio frame parsing. _Rejected:_ global
  runtime logging across every entrypoint.

## Referenced by

[[app/_MOC]] · [[server-main]] · [[app-config]] · [[Transport]]
