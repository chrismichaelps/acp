---
type: module
path: '@root/src/config/app-config.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
tags: [module, test, config]
aliases: [app-config.test]
---

# App Config Tests

## Purpose

Pin [[app-config]] defaults, deployment-profile presets, explicit override
precedence, unit conversions, and fail-fast rejection of unknown profiles.

## Interface

Vitest suite that resolves `AppConfigTag` from `AppConfigLive` under an isolated
Effect `ConfigProvider` map.

## Algorithm

Assert the empty environment's port, log level, adapters, SQLite path, lease TTL,
retention, artifact limit, auth defaults, and trusted-client issuer. Verify
`local`, `single-node`, `hosted`, and `self-host-ha` profile presets. Hosted must
resolve to static issuance, required auth, and required workspace bindings even
when weaker overrides are supplied. Prove ordinary explicit variables override
profile values, reject unsupported `ACP_PROFILE=staging`, reject static issuance
without auth/bindings, preserve the opaque optional policy string, and check
environment overrides including duration and megabyte-to-byte conversion.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT let a profile override an explicitly supplied variable.
- ❌ Do NOT accept unknown profile names by falling back to `local`.
- ❌ Do NOT compare duration or artifact-size source strings; assert normalized
  milliseconds and bytes.
- ❌ Do NOT mutate `process.env`; configuration isolation is part of the test.
- ❌ Do NOT treat a parseable policy as sufficient when the surrounding auth
  boundary is unsafe; configuration must fail before the server becomes ready.

## Grill Log

- **Q:** Should profiles and individual variables be tested separately? **A:**
  Both are required because precedence is a distinct contract. _Rejected:_ preset
  snapshots that cannot prove explicit overrides win.

## Referenced by

[[app-config]] · [[config/_MOC]] · [[src/_MOC]]
