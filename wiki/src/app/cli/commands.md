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
the CLI; [[cli-client]] sends what it returns. Shared request/error primitives
live in [[cli-command-support]], and feature command maps such as
[[cli-session-commands]], [[cli-event-commands]], and [[cli-memory-commands]]
extend the central dispatch table without growing the parser file.

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

| Argv                                                                                  | → request                                         |
| ------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `session init --worker --name [--kind] [--vendor] [--capabilities] [--permissions]`   | `POST /v1/session/initialize`                     |
| `worker list`                                                                         | `GET /v1/workers`                                 |
| `worker get <worker_id>`                                                              | `GET /v1/workers/<id>`                            |
| `workspace list`                                                                      | `GET /v1/workspaces`                              |
| `workspace create --name --kind --uri [--default-branch]`                             | `POST /v1/workspaces`                             |
| `workspace update <workspace_id> --name --kind --uri [--default-branch]`              | `PATCH /v1/workspaces/<id>`                       |
| `workspace archive <workspace_id>`                                                    | `POST /v1/workspaces/<id>/archive`                |
| `work create <title> --workspace <id> [--priority] [--description]`                   | `POST /v1/work`                                   |
| `work list --workspace <id>`                                                          | `GET /v1/workspaces/<id>/work`                    |
| `work get <work_id>`                                                                  | `GET /v1/work/<id>`                               |
| `work claim <work_id> --worker <id>`                                                  | `POST /v1/work/<id>/claim`                        |
| `work update <work_id> --state <s>`                                                   | `PATCH /v1/work/<id>`                             |
| `lease request --workspace --holder --kind --uri [--ttl]`                             | `POST /v1/leases`                                 |
| `lease release <lease_id>`                                                            | `POST /v1/leases/<id>/release`                    |
| `lease renew <lease_id> [--ttl]`                                                      | `POST /v1/leases/<id>/renew`                      |
| `lease revoke <lease_id>`                                                             | `POST /v1/leases/<id>/revoke`                     |
| `checkpoint create --workspace --work --summary`                                      | `POST /v1/checkpoints`                            |
| `checkpoint list --work <id> \| --workspace <id>`                                     | `GET /v1/work/<id>/checkpoints` or workspace list |
| `checkpoint latest --work <id>`                                                       | `GET /v1/work/<id>/checkpoints/latest`            |
| `artifact create --workspace --work --kind [--uri] [--summary] [--content]`           | `POST /v1/artifacts`                              |
| `artifact pr --workspace --work --url [--summary]`                                    | `POST /v1/artifacts` as `pull_request`            |
| `artifact update <artifact_id> --kind [--uri] [--media-type] [--summary] [--content]` | `PATCH /v1/artifacts/<id>`                        |
| `artifact list --work <id> \| --workspace <id>`                                       | `GET /v1/work/<id>/artifacts` or workspace list   |
| `artifact content <artifact_id>`                                                      | `GET /v1/artifacts/<id>/content`                  |
| `artifact delete <artifact_id>`                                                       | `DELETE /v1/artifacts/<id>`                       |
| `review request --work --by [--reviewer]`                                             | `POST /v1/reviews`                                |
| `review list --work <id> \| --workspace <id>`                                         | `GET /v1/work/<id>/reviews` or workspace list     |
| `review approve <review_id> --met <csv>`                                              | `POST /v1/reviews/<id>/approve`                   |
| `review reject <review_id>`                                                           | `POST /v1/reviews/<id>/reject`                    |
| `review request-changes <review_id>`                                                  | `POST /v1/reviews/<id>/request_changes`           |
| `review cancel <review_id>`                                                           | `POST /v1/reviews/<id>/cancel`                    |
| `events list --workspace <id> [--after <seq>]`                                        | `GET /v1/events?workspace_id=&after_seq=`         |
| `events stream --workspace <id>`                                                      | `GET /v1/events/stream?workspace_id=`             |
| `memory create --workspace --kind --key --summary --content [--work] [--labels]`      | `POST /v1/memory`                                 |
| `memory list --workspace [--after] [--limit] [--work] [--kind] [--key] [--label]`     | `GET /v1/memory?workspace_id=&after_seq=`         |

### Linkage

- **Requires:** Effect `Either`/`Data` only (no services).
- **Consumed by:** [[cli-main]], [[cli-client]].

## Algorithm

Split `argv` through a small token parser registry rather than a branch chain:
flag tokens own `--key value` and valueless `--key` handling, while the fallback
token parser records positionals. The public `<group> <action>` command key is
then resolved through the command handler table. Each handler receives the
parsed positionals and flags, validates its own required inputs (missing →
`CliError`) and assembles a `CliRequest` with encoded route parameters and query
values. Unknown keys never fall through a conditional chain; they return the same
`CliError` as any unsupported command. Numeric lease TTLs are validated as
positive safe integers before HTTP decoding.
Session bootstrap is registered by [[cli-session-commands]] so authenticated CLI
operators can mint a bearer session before exporting `ACP_RPC_TOKEN`.
`--default-branch` and `--media-type` normalize to the schema's snake_case JSON
fields. Artifact create/update forward optional `--uri` so the CLI can register
external pull request, commit, report, or screenshot artifacts without inline
content. `artifact pr` is a convenience projection over the same create route:
it requires `--url`, fixes `kind` to `pull_request`, and leaves ACP as a
coordination ledger rather than a GitHub actor. Lease renewal accepts optional
`--ttl` and otherwise lets the host use its default lease TTL. Worker registry
reads map `worker list` and `worker get` onto host-scoped presence endpoints.
Work resume reads map `work list --workspace`, `work get`,
`checkpoint list/latest --work`, `artifact list --work`,
`artifact content <id>`, and `review list --work` onto the read endpoints.
`checkpoint list`, `artifact list`, and `review list` also accept `--workspace`
for workspace-level aggregate resume reads. `events list` maps to the JSON replay
route with an optional non-negative `--after` cursor. `review approve --met` is a
comma-separated list that becomes `met_requirements`. `review cancel` maps to the
dedicated review cancellation route so withdrawal is not expressed as rejection.
`events stream` sets `stream: true`. Session, event, and memory handlers are
registered by spreading their feature command maps into the central table,
preserving one dispatch point while keeping the parser below the file-size gate.
The parser regression suite pins the tokenizer edge where a valueless flag is
followed by another flag token so future command additions do not accidentally
consume the next flag as a value.

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

[[cli-index]] · [[cli-client]] · [[cli-main]] · [[cli-usage]] ·
[[cli-event-commands]] · [[cli-memory-commands]] ·
[[cli-session-commands]] · [[artifact-pr-command-test]] · [[Transport]] ·
[[src/_MOC]]
