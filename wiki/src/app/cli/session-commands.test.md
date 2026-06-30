---
type: module
path: '@root/src/app/cli/session-commands.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
depth_score: 0.42
depth_status: MEDIUM
tags: [module, medium, test]
aliases: [session-commands-test]
---

# Session Commands Test

## Purpose

Pin `session init` parser behavior so authenticated CLI use has a stable
bootstrap command for minting bearer sessions.

## Interface

```typescript
describe('session commands', () => {
  it('parses session init as the open bearer-session bootstrap route', ...)
  it('requires worker identity fields before bootstrapping a session', ...)
})
```

## Algorithm

The happy-path assertion parses worker identity, vendor, capabilities, and
permissions into the `POST /v1/session/initialize` request shape consumed by
[[acp-router]]. The validation assertion omits `--name` and expects
`CliError` before [[cli-client]] can send an incomplete bootstrap payload.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT exercise the server here; this test is only for pure argv parsing.
- ❌ Do NOT assert token persistence; the CLI prints the host response and lets
  operators decide how to export `ACP_RPC_TOKEN`.

## Depth

MEDIUM (0.42). Narrow regression coverage for a security-relevant CLI command.

## Referenced by

[[cli/_MOC]] · [[cli-session-commands]]
