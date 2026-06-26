---
type: module
path: '@root/src/app/cli/commands.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.7
depth_status: DEEP
tags: [module, deep]
aliases: [cli-commands, parseArgs]
---

# CLI Command Parser

## Purpose

Pure parser turning `process.argv` tokens into a `CliRequest` (method · path ·
body · stream) for the spec §21 CLI. No I/O — the parser is the testable core of
the CLI; [[cli-client]] sends what it returns.

## Interface

### Signatures

```typescript
export interface CliRequest {
  readonly method: 'GET' | 'POST' | 'PATCH'
  readonly path: string
  readonly body?: Record<string, unknown>
  readonly stream?: boolean
  readonly label: string
}
export class CliError extends Data.TaggedError('CliError')<{
  readonly message: string
}> {}
export const parseArgs: (
  argv: readonly string[],
) => Either<CliRequest, CliError>
```

### Commands (spec §21)

| Argv                                                                | → request                             |
| ------------------------------------------------------------------- | ------------------------------------- |
| `workspace list`                                                    | `GET /v1/workspaces`                  |
| `work create <title> --workspace <id> [--priority] [--description]` | `POST /v1/work`                       |
| `work claim <work_id> --worker <id>`                                | `POST /v1/work/<id>/claim`            |
| `work update <work_id> --state <s>`                                 | `PATCH /v1/work/<id>`                 |
| `lease request --workspace --holder --kind --uri [--ttl]`           | `POST /v1/leases`                     |
| `lease release <lease_id>`                                          | `POST /v1/leases/<id>/release`        |
| `checkpoint create --workspace --work --summary`                    | `POST /v1/checkpoints`                |
| `artifact create --workspace --work --kind [--summary] [--content]` | `POST /v1/artifacts`                  |
| `review request --work --by [--reviewer]`                           | `POST /v1/reviews`                    |
| `events stream --workspace <id>`                                    | `GET /v1/events/stream?workspace_id=` |

### Linkage

- **Requires:** Effect `Either`/`Data` only (no services).
- **Consumed by:** [[cli-main]], [[cli-client]].

## Algorithm

Split `argv` into positionals and `--key value` flags. Switch on
`(group, action)`; validate required flags (missing → `CliError`) and positive
integer TTLs; assemble the `CliRequest` with encoded route parameters and query
values. `events stream` sets `stream: true`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT perform I/O or build HTTP clients here — return data only.
- ❌ Do NOT throw — unknown/invalid commands return `Either.left(CliError)`.
- ❌ Do NOT pass raw route/query values into URLs — encode them at parse time.

## Depth

DEEP (0.7). Hides the whole argv→request mapping behind one pure function with an
exhaustive command table; trivially testable without a server.

## Grill Log

- **Q:** In-process (call services on [[app-live]]) or HTTP client to [[acp-router]]?
  **A:** HTTP client. _Rationale:_ v0.1 storage is InMemory and per-process, so
  `work create` then `work claim` in separate invocations only share state through
  the running local host (spec §21 "Local ACP host"). An in-process CLI would reset
  state every command. _Rejected:_ in-process (only viable for one-shot scripted
  flows; doesn't match the discrete stateful commands in the spec example).
- **Q:** Add `@effect/cli`?
  **A:** No. _Rationale:_ avoid a new pinned dependency for a small command set;
  `process.argv` + a pure parser is enough and keeps the grammar's SDK surface
  fixed. _Rejected:_ `@effect/cli` (heavier; revisit if the CLI grows subcommand
  trees/help generation).

## Referenced by

[[cli-index]] · [[cli-client]] · [[cli-main]] · [[Transport]] · [[src/_MOC]]
