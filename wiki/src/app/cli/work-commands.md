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
`POST /v1/work`. `work list --workspace <id>` maps to
`GET /v1/workspaces/<id>/work`. `work get <work_id>` maps to `GET /v1/work/<id>`.
`work claim <work_id> --worker <id>` maps to `POST /v1/work/<id>/claim`.
`work update <work_id> --state <s>` maps to `PATCH /v1/work/<id>`.

## Algorithm

Create requires a title positional and workspace flag, then forwards optional
description and priority fields unchanged. List URL-encodes the workspace id in
the collection path. Get, claim, and update URL-encode the work id before placing
it in the route. Claim normalizes `--worker` to the `worker_id` request field,
and update sends only the target state.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT call domain services here; this module only builds `CliRequest` data.
- ❌ Do NOT pass raw workspace or work ids into route paths.
- ❌ Do NOT handle checkpoint, artifact, or review resume reads here; those have
  separate collection semantics.

## Depth

MEDIUM (0.55). It keeps work lifecycle parser rules local to one additive
command map and further reduces the central parser's file-size pressure.

## Referenced by

[[cli-commands]] · [[cli/_MOC]]
