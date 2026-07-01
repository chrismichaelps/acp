---
type: module
path: '@root/src/app/cli/checkpoint-commands.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.55
depth_status: MEDIUM
tags: [module, medium]
aliases: [cli-checkpoint-commands]
---

# CLI Checkpoint Commands

## Purpose

Own the checkpoint CLI command map consumed by [[cli-commands]]. Checkpoint
creation and readback are work-resume primitives, so their parser rules live in
an additive registry module instead of expanding the central `parseArgs`
dispatcher.

## Interface

```typescript
export const checkpointCommandHandlers: Readonly<Record<string, CommandHandler>>
```

`checkpoint create --workspace --work --summary` maps to `POST /v1/checkpoints`.
`checkpoint list --work <id> | --workspace <id>` maps to the work-scoped or
workspace-scoped checkpoint collection. `checkpoint latest --work <id>` maps to
`GET /v1/work/<id>/checkpoints/latest`.

## Algorithm

Create requires workspace, work, and summary flags, then sends empty step and
resource lists because the current CLI exposes the lightweight smoke path rather
than a full checkpoint authoring grammar. List delegates to
`scopedWorkListPath`, preserving the shared `--workspace` or `--work` behavior
used by resume collections. Latest requires `--work` and URL-encodes the work id
before constructing the route.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT infer checkpoint contents from the workspace; callers must pass
  explicit fields.
- ❌ Do NOT query checkpoint storage directly.
- ❌ Do NOT duplicate the work/workspace collection path logic.

## Depth

MEDIUM (0.55). The module isolates checkpoint parser rules and shares collection
path construction through [[cli-command-support]].

## Referenced by

[[cli-commands]] · [[cli-command-support]] · [[cli/_MOC]]
