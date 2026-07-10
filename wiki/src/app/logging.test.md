---
type: module
path: '@root/src/app/logging.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
tags: [module, test, app, logging]
aliases: [logging.test, app-logging.test]
---

# App Logging Tests

## Purpose

Pin the translation between ACP's documented log-level vocabulary and Effect's
runtime levels, including default and environment-driven configuration.

## Interface

Vitest suite for [[app-logging|toEffectLogLevel]] and the shared
`appLogLevelConfig` value using isolated Effect config providers.

## Algorithm

Assert `debug`, `info`, `warn`, and `error` map to `Debug`, `Info`, `Warning`, and
`Error`. Read the configuration with no variables to prove `info` remains the
default, then set `ACP_LOG_LEVEL=warn` to prove the runtime override is honored.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT map `warn` to a guessed string or numeric severity; use Effect's
  `LogLevel.Warning` value.
- ❌ Do NOT duplicate a different default from [[app-config]].
- ❌ Do NOT read the process environment directly in the test.

## Grill Log

- **Q:** Should this suite snapshot JSON log output? **A:** Not for this
  boundary. It owns level vocabulary and configuration parity; logger rendering
  belongs to runtime integration. _Rejected:_ brittle serialized-log snapshots.

## Referenced by

[[app-logging]] · [[app-config]] · [[app/_MOC]] · [[src/_MOC]]
