---
type: module
path: '@root/src/app/cli/workspace-commands.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.55
depth_status: MEDIUM
tags: [module, medium]
aliases: [cli-workspace-commands]
---

# CLI Workspace Commands

## Purpose

Own the workspace CLI command map consumed by [[cli-commands]]. Workspace list,
create, update, and archive are host-level operations with shared flag
validation and path encoding, so they live as an additive registry module instead
of expanding the central `parseArgs` dispatch table.

## Interface

```typescript
export const workspaceCommandHandlers: Readonly<Record<string, CommandHandler>>
```

`workspace list` maps to `GET /v1/workspaces`.
`workspace create --name --kind --uri [--default-branch]` maps to
`POST /v1/workspaces`. `workspace update <workspace_id> --name --kind --uri
[--default-branch]` maps to `PATCH /v1/workspaces/<id>`. `workspace archive
<workspace_id>` maps to `POST /v1/workspaces/<id>/archive`.

## Algorithm

Create and update require name, kind, and URI flags before HTTP decoding. Both
normalize optional `--default-branch` to the schema's `default_branch` field.
Update and archive encode the workspace id as a route path segment so repository
style names with slashes do not break routing. List is bodyless and does not read
flags.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT talk to storage or HTTP here; this module only builds `CliRequest`
  data.
- ❌ Do NOT pass raw workspace ids into route paths.
- ❌ Do NOT add work-unit commands here; those have separate lifecycle semantics.

## Depth

MEDIUM (0.55). It isolates workspace-specific argv mapping behind the same
registry pattern as session, event, lease, and memory commands.

## Referenced by

[[cli-commands]] · [[cli/_MOC]]
