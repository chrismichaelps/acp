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
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
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

| Argv                                                                                  | → request                               |
| ------------------------------------------------------------------------------------- | --------------------------------------- |
| `workspace list`                                                                      | `GET /v1/workspaces`                    |
| `workspace create --name --kind --uri [--default-branch]`                             | `POST /v1/workspaces`                   |
| `workspace update <workspace_id> --name --kind --uri [--default-branch]`              | `PATCH /v1/workspaces/<id>`             |
| `workspace archive <workspace_id>`                                                    | `POST /v1/workspaces/<id>/archive`      |
| `work create <title> --workspace <id> [--priority] [--description]`                   | `POST /v1/work`                         |
| `work get <work_id>`                                                                  | `GET /v1/work/<id>`                     |
| `work claim <work_id> --worker <id>`                                                  | `POST /v1/work/<id>/claim`              |
| `work update <work_id> --state <s>`                                                   | `PATCH /v1/work/<id>`                   |
| `lease request --workspace --holder --kind --uri [--ttl]`                             | `POST /v1/leases`                       |
| `lease release <lease_id>`                                                            | `POST /v1/leases/<id>/release`          |
| `checkpoint create --workspace --work --summary`                                      | `POST /v1/checkpoints`                  |
| `checkpoint list --work <id>`                                                         | `GET /v1/work/<id>/checkpoints`         |
| `checkpoint latest --work <id>`                                                       | `GET /v1/work/<id>/checkpoints/latest`  |
| `artifact create --workspace --work --kind [--uri] [--summary] [--content]`           | `POST /v1/artifacts`                    |
| `artifact update <artifact_id> --kind [--uri] [--media-type] [--summary] [--content]` | `PATCH /v1/artifacts/<id>`              |
| `artifact list --work <id>`                                                           | `GET /v1/work/<id>/artifacts`           |
| `artifact delete <artifact_id>`                                                       | `DELETE /v1/artifacts/<id>`             |
| `review request --work --by [--reviewer]`                                             | `POST /v1/reviews`                      |
| `review approve <review_id> --met <csv>`                                              | `POST /v1/reviews/<id>/approve`         |
| `review reject <review_id>`                                                           | `POST /v1/reviews/<id>/reject`          |
| `review request-changes <review_id>`                                                  | `POST /v1/reviews/<id>/request_changes` |
| `events stream --workspace <id>`                                                      | `GET /v1/events/stream?workspace_id=`   |

### Linkage

- **Requires:** Effect `Either`/`Data` only (no services).
- **Consumed by:** [[cli-main]], [[cli-client]].

## Algorithm

Split `argv` into positionals and `--key value` flags, derive the public
`<group> <action>` command key, and resolve it through a command handler table.
Each handler receives the parsed positionals and flags, validates its own
required inputs (missing → `CliError`) and assembles a `CliRequest` with encoded
route parameters and query values. Unknown keys never fall through a conditional
chain; they return the same `CliError` as any unsupported command. Numeric lease
TTLs are validated as positive safe integers before HTTP decoding.
`--default-branch` and `--media-type` normalize to the schema's snake_case JSON
fields. Artifact create/update forward optional `--uri` so the CLI can register
external pull request, commit, report, or screenshot artifacts without inline
content. Work resume reads map `work get`, `checkpoint list/latest --work`, and
`artifact list --work` onto the work-scoped read endpoints. `review approve
--met` is a comma-separated list that becomes `met_requirements`. `events stream`
sets `stream: true`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT perform I/O or build HTTP clients here — return data only.
- ❌ Do NOT throw — unknown/invalid commands return `Either.left(CliError)`.
- ❌ Do NOT pass raw route/query values into URLs — encode them at parse time.

## Depth

DEEP (0.7). Hides the whole argv→request mapping behind one pure function and a
small handler registry; adding a command is an additive table entry instead of a
new branch in the parser's dispatch path. The parser remains trivially testable
without a server.

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
