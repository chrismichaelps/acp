---
type: module
path: '@root/src/app/cli/memory-commands.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.55
depth_status: MEDIUM
tags: [module, medium]
aliases: [cli-memory-commands]
---

# CLI Memory Commands

## Purpose

Own the workspace [[Memory]] CLI command map consumed by [[cli-commands]]. The
module keeps memory-specific request construction beside its focused tests while
the main parser remains a small command dispatcher.

## Interface

```typescript
export const memoryCommandHandlers: Readonly<Record<string, CommandHandler>>
```

`memory create --workspace --kind --key --summary --content [--work] [--labels]`
maps to `POST /v1/memory`. `memory list --workspace [--after] [--limit] [--work]
[--kind] [--key] [--label]` maps to `GET /v1/memory`.

## Algorithm

`memory create` requires the workspace, kind, key, summary, and content fields,
normalizes optional `--work` to `work_id`, and parses optional comma-separated
labels into a trimmed list that defaults to `[]`. `memory list` requires
`--workspace`, defaults `--after` to `0`, validates it as a non-negative safe
integer, and appends only provided filters to the encoded query string so
servers do not receive empty predicates.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT decode [[Memory]] schemas here; HTTP and service edges own schema
  validation.
- ❌ Do NOT query storage directly; this module only builds `CliRequest` data.
- ❌ Do NOT add unrelated command groups here.

## Depth

MEDIUM (0.55). It hides memory argv details behind an additive command map and
keeps the parser's public API stable as feature areas split out.

## Referenced by

[[memory-commands.test]] · [[cli-commands]] · [[cli/_MOC]]
