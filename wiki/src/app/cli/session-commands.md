---
type: module
path: '@root/src/app/cli/session-commands.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.52
depth_status: MEDIUM
tags: [module, medium, cli]
aliases: [cli-session-commands, session-commands]
---

# CLI Session Commands

## Purpose

Own the CLI command map for bearer-session bootstrap. `session init` gives a
local operator a typed way to call `POST /v1/session/initialize` before setting
`ACP_RPC_TOKEN` for later authenticated [[cli-client]] calls.

## Interface

```typescript
export const sessionCommandHandlers: Readonly<
  Record<string, CommandHandler | undefined>
>
```

The module registers `session init --worker <id> --name <n> [--kind <k>]
[--vendor <v>] [--capabilities <csv>] [--permissions <csv>]`.

## Algorithm

The handler validates required worker id and name flags, defaults kind to
`agent`, forwards optional vendor, parses capability and permission CSV flags
into arrays, and returns a `POST /v1/session/initialize` [[cli-commands]]
request. The server schema keeps protocol version, worker status, and host
capability negotiation defaults at the HTTP boundary.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT store the returned session id in process state; the operator decides
  how to export `ACP_RPC_TOKEN`.
- ❌ Do NOT grant shell, filesystem, GitHub, or cloud powers here; permissions are
  ACP scopes only.
- ❌ Do NOT perform HTTP I/O; [[cli-client]] sends the request.

## Depth

MEDIUM (0.52). The command is small, but isolating session bootstrap keeps the
central parser table from growing into another branch-heavy module.

## Referenced by

[[cli/_MOC]] · [[cli-commands]]
