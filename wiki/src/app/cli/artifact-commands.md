---
type: module
path: '@root/src/app/cli/artifact-commands.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.6
depth_status: MEDIUM
tags: [module, medium]
aliases: [cli-artifact-commands]
---

# CLI Artifact Commands

## Purpose

Own the artifact CLI command map consumed by [[cli-commands]]. Artifact creation,
pull request registration, metadata updates, collection readback, content reads,
and deletion have enough route and payload shaping to live outside the central
`parseArgs` dispatcher.

## Interface

```typescript
export const artifactCommandHandlers: Readonly<Record<string, CommandHandler>>
```

`artifact create --workspace --work --kind [--uri] [--summary] [--content]` maps
to `POST /v1/artifacts`. `artifact pr --workspace --work --url [--summary]` is a
convenience projection over the same create route with `kind: "pull_request"`.
`artifact update <artifact_id> --kind [--uri] [--media-type] [--summary]
[--content]` maps to `PATCH /v1/artifacts/<id>`. `artifact list --work <id> |
--workspace <id> [--kind <kind>]` maps to the work-scoped or workspace-scoped
artifact collection and, when `--kind` is supplied, records a client-side `kind`
filter for [[cli-client]]. `artifact content <artifact_id>` and
`artifact delete <artifact_id>` map to the artifact content and delete routes.

## Algorithm

Create and PR registration require workspace and work ids, then forward optional
metadata only when provided. Update requires artifact id and kind, normalizes
`--media-type` to `media_type`, and forwards optional URI, summary, and content.
List delegates to `scopedWorkListPath` for consistent `--workspace` /
`--work` collection routing, then adds an optional `kind` client filter so agents
can recover a specific artifact class without changing the host route. Content
and delete URL-encode the artifact id before constructing their routes.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT talk to GitHub or fetch pull request state; `artifact pr` only records
  the supplied URL as ACP artifact metadata.
- ❌ Do NOT inline artifact content limits here; service/schema boundaries own
  validation.
- ❌ Do NOT filter artifact responses here; [[cli-client]] applies client filters
  after fetch.
- ❌ Do NOT duplicate scoped collection path construction.

## Depth

MEDIUM (0.6). This module isolates the artifact command grammar and keeps the
central parser focused on tokenization and registry dispatch.

## Referenced by

[[cli-commands]] · [[cli-command-support]] · [[artifact-pr-command-test]] ·
[[cli/_MOC]]
