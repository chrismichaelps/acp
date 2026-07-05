---
type: module
path: '@root/src/app/cli/work-commands.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.55
depth_status: MEDIUM
tags: [module, medium]
aliases: [cli-work-commands]
---

# CLI Work Commands

## Purpose

Own the work-unit CLI command map consumed by [[cli-commands]]. Work creation,
listing, readback, claiming, and state updates are the core operator path for ACP
workers, so their argv mapping is isolated from the central `parseArgs`
dispatcher while preserving the same public CLI behavior.

## Interface

```typescript
export const workCommandHandlers: Readonly<Record<string, CommandHandler>>
```

`work create <title> --workspace <id> [--priority] [--description]` maps to
`POST /v1/work`. `work list --workspace <id> [--state <s>] [--priority <p>]
[--assigned-to <worker_id>]` maps to `GET /v1/workspaces/<id>/work`, and when a
filter is supplied it records field/value entries on the `CliRequest`
`clientFilters` field so [[cli-client]] filters the returned array client-side.
`work get <work_id>` maps to `GET /v1/work/<id>`. `work resume <work_id>` maps
to `GET /v1/work/<id>/resume` for the compact handoff packet. `work claim
<work_id> --worker <id>` maps to `POST /v1/work/<id>/claim`. `work update
<work_id> --state <s>` maps to `PATCH /v1/work/<id>`.

## Algorithm

Create requires a title positional and workspace flag, then forwards optional
description and priority fields unchanged. List URL-encodes the workspace id in
the collection path and records any `--state`, `--priority`, or `--assigned-to`
filters as generic field/value pairs on the request so the response is narrowed
after fetch — the route and host stay unchanged. The assignee flag maps to the
wire response field `assigned_to`. Get, resume, claim, and update URL-encode the
work id before placing it in the route. Resume is the token-efficient handoff
read: it returns work metadata, latest checkpoint, artifact metadata, and review
state in one packet. Claim normalizes `--worker` to the `worker_id` request
field, and update sends only the target state.

The `--state`, `--priority`, and `--assigned-to` filters are **client-side
conveniences** (grillme): the work-list route is a typed `HttpApi` endpoint and
`[[acp-http-api]]` is at the file-size gate, so adding host-side url params would
ripple through schema, handler, domain, and storage. Filtering the
already-fetched array in [[cli-client]] gives an agent one-flag paths for
claimable (`open`) work, urgent (`high`) work, or "my assigned work" at zero
protocol/storage cost. Rejected: host-side url-params (heavier, gated), and a
new `work discover` command (redundant with list).

## Negative Logic (Prohibited Paths)

- ❌ Do NOT call domain services here; this module only builds `CliRequest` data.
- ❌ Do NOT pass raw workspace or work ids into route paths.
- ❌ Do NOT filter the response here; this module only sets `clientFilters` —
  [[cli-client]] applies it after fetch.
- ❌ Do NOT make `work resume` fetch artifact content; it returns metadata so the
  agent can choose which artifact content to read.

## Depth

MEDIUM (0.55). It keeps work lifecycle parser rules local to one additive
command map and further reduces the central parser's file-size pressure.

## Referenced by

[[cli-commands]] · [[cli/_MOC]]
