---
type: module
path: '@root/src/app/cli/review-commands.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.6
depth_status: MEDIUM
tags: [module, medium]
aliases: [cli-review-commands]
---

# CLI Review Commands

## Purpose

Own the review CLI command map consumed by [[cli-commands]]. Review request,
readback, approval, rejection, request-changes, and cancellation are human-gate
workflow operations, so their parser rules live outside the central `parseArgs`
dispatcher.

## Interface

```typescript
export const reviewCommandHandlers: Readonly<Record<string, CommandHandler>>
```

`review request --work --by [--reviewer]` maps to `POST /v1/reviews`.
`review list --work <id> | --workspace <id>` maps to the work-scoped or
workspace-scoped review collection. `review approve <review_id> --met <csv>`
maps to the approval route. `review reject`, `review request-changes`, and
`review cancel` map to their review-id scoped state routes.

## Algorithm

Request requires work id and requester, includes an empty requirements list, and
only includes reviewer when `--reviewer` has a real value. List delegates to
`scopedWorkListPath` for the shared `--workspace` / `--work` collection
precedence. Approve parses `--met` as a comma-separated list and sends it as
`met_requirements`. Reject, request-changes, and cancel share a bodyless state
command helper that URL-encodes the review id.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT model cancellation as rejection; `review cancel` has its own route.
- ❌ Do NOT decide review outcomes here; this module only builds request data.
- ❌ Do NOT duplicate scoped collection path construction.

## Depth

MEDIUM (0.6). It isolates review workflow parser rules and completes the CLI
feature-registry split for the central parser.

## Referenced by

[[cli-commands]] · [[cli-command-support]] · [[cli/_MOC]]
