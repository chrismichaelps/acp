---
type: module
path: '@root/src/app/cli/usage.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.45
depth_status: MEDIUM
tags: [module, medium]
aliases: [cli-usage]
---

# CLI Usage Text

## Purpose

Own the printable CLI usage table separately from [[cli-commands]] so the pure
parser can keep growing by command handler without carrying display-only text or
crossing the file-size gate. The table includes host-scoped worker reads,
workspace/work flows, lease lifecycle, artifact evidence commands including pull
request URL registration, resume reads, review actions, event replay, and event
streaming.

## Interface

```typescript
export const usage: string
```

## Algorithm

No runtime logic. The module exports the usage string consumed by [[cli-main]]
when `parseArgs` returns `CliError`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT parse argv here; [[cli-commands]] owns command semantics.
- ❌ Do NOT perform I/O here; [[cli-main]] decides where to print the text.

## Depth

MEDIUM (0.45). It is intentionally simple display text, but separating it keeps
the parser module focused and under the repository size gate.

## Referenced by

[[cli-main]] · [[cli/_MOC]]
