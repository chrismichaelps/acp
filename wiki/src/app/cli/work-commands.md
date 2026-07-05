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
`POST /v1/work`. `work list --workspace <id> [--state <s>]` maps to
`GET /v1/workspaces/<id>/work`, and when `--state` is supplied it records the
target state on the `CliRequest` `filterState` field so [[cli-client]] filters
the returned array client-side. `work get <work_id>` maps to `GET /v1/work/<id>`.
`work claim <work_id> --worker <id>` maps to `POST /v1/work/<id>/claim`.
`work update <work_id> --state <s>` maps to `PATCH /v1/work/<id>`.

## Algorithm

Create requires a title positional and workspace flag, then forwards optional
description and priority fields unchanged. List URL-encodes the workspace id in
the collection path and, when `--state` is present, sets `filterState` on the
request so the response is narrowed after fetch — the route and host stay
unchanged. Get, claim, and update URL-encode the work id before placing it in the
route. Claim normalizes `--worker` to the `worker_id` request field, and update
sends only the target state.

The `--state` filter is a **client-side convenience** (grillme): the work-list
route is a typed `HttpApi` endpoint and `[[acp-http-api]]` is at the file-size
gate, so adding a host-side `state` url-param would ripple through schema,
handler, domain, and storage. Filtering the already-fetched array in
[[cli-client]] gives an agent a one-flag "show me claimable (`open`) work" path
at zero protocol/storage cost. Rejected: host-side url-param (heavier, gated),
and a new `work discover` command (redundant with list).

## Negative Logic (Prohibited Paths)

- ❌ Do NOT call domain services here; this module only builds `CliRequest` data.
- ❌ Do NOT pass raw workspace or work ids into route paths.
- ❌ Do NOT filter the response here; this module only sets `filterState` —
  [[cli-client]] applies it after fetch.
- ❌ Do NOT handle checkpoint, artifact, or review resume reads here; those have
  separate collection semantics.

## Depth

MEDIUM (0.55). It keeps work lifecycle parser rules local to one additive
command map and further reduces the central parser's file-size pressure.

## Referenced by

[[cli-commands]] · [[cli/_MOC]]
