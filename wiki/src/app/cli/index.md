---
type: module
path: '@root/src/app/cli/index.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
depth_score: 0.5
depth_status: MEDIUM
tags: [module]
aliases: [cli-index]
---

# CLI Barrel

## Purpose

Opaque public surface for the CLI: re-exports [[cli-commands]] and [[cli-client]].
Excludes [[cli-main]] (a side-effecting entrypoint) and [[cli-usage]] (display
text used only by the entrypoint).

## Interface

### Signatures

```typescript
export * from './commands.js'
export * from './client.js'
```

### Linkage

- **Requires:** [[cli-commands]], [[cli-client]]
- **Consumed by:** [[cli-main]] and CLI tests.

## Algorithm

No behavior. Re-export-only module enforcing the Export Law from
[[grammar/typescript]].

## Negative Logic (Prohibited Paths)

- ❌ Do NOT re-export [[cli-main]] — it runs on import.
- ❌ Do NOT re-export [[cli-usage]] unless an external consumer needs display
  text as API.

## Depth

MEDIUM (0.5). Aggregates the CLI surface.

## Referenced by

[[cli/_MOC]] · [[src/_MOC]]
