---
type: module
path: '@root/src/app/cli/command-support.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.55
depth_status: MEDIUM
tags: [module, medium]
aliases: [cli-command-support]
---

# CLI Command Support

## Purpose

Shared parser primitives for [[cli-commands]] and feature command maps such as
[[cli-checkpoint-commands]], [[cli-event-commands]], [[cli-lease-commands]], and
[[cli-memory-commands]]. The module owns the stable `CliRequest`/`CliError`
contract plus small validation, encoding, and scoped-collection helpers so
feature command maps can be split without import cycles or duplicate error
classes.

## Interface

```typescript
export interface CliRequest
export class CliError
export interface Parsed
export type CommandHandler
export const flag: (...)
export const positional: (...)
export const optional: (...)
export const optionalAs: (...)
export const optionalQuery: (...)
export const csvFlag: (...)
export const encodePathSegment: (...)
export const scopedWorkListPath: (...)
export const integerFlag: (...)
export const positiveIntegerFlag: (...)
```

## Algorithm

The helpers are pure transformations over already-tokenized positionals and
flags. Required positional and flag reads return `CliError` in the `Either`
error channel. Optional helpers only materialize fields when the flag has a
real value, query helpers URL-encode their values, CSV values trim empty
segments, and integer helpers reject unsafe or below-minimum values before a
request reaches HTTP decoding. `scopedWorkListPath` centralizes collection routes
that can be addressed by either `--workspace` or `--work`, so checkpoint,
artifact, and review command maps do not duplicate that precedence rule.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT parse `argv` here; [[cli-commands]] owns tokenization and dispatch.
- ❌ Do NOT perform transport I/O or schema decoding here.
- ❌ Do NOT add feature-specific command behavior here; use a command map module.

## Depth

MEDIUM (0.55). The module removes duplicate parsing mechanics from feature
command maps while preserving a small, stable helper interface.

## Referenced by

[[cli-checkpoint-commands]] · [[cli-commands]] · [[cli-event-commands]] ·
[[cli-lease-commands]] · [[cli-memory-commands]] · [[cli/_MOC]]
