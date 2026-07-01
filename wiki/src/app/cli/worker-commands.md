---
type: module
path: '@root/src/app/cli/worker-commands.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.45
depth_status: MEDIUM
tags: [module, medium]
aliases: [cli-worker-commands]
---

# CLI Worker Commands

## Purpose

Own the worker registry CLI command map consumed by [[cli-commands]]. Worker
presence is host-scoped, so list/get parsing stays separate from workspace and
work-unit lifecycle commands while using the same additive registry pattern.

## Interface

```typescript
export const workerCommandHandlers: Readonly<Record<string, CommandHandler>>
```

`worker list` maps to `GET /v1/workers`. `worker get <worker_id>` maps to
`GET /v1/workers/<id>`.

## Algorithm

List is a bodyless request with no flags. Get requires one worker id positional
and URL-encodes it before placing it in the route path.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT infer workspace membership here; workers are host-scoped.
- ❌ Do NOT pass raw worker ids into route paths.
- ❌ Do NOT query storage or worker services directly.

## Depth

MEDIUM (0.45). The module is intentionally small; its value is keeping every CLI
feature family behind a registry entry rather than a growing parser file.

## Referenced by

[[cli-commands]] · [[cli/_MOC]]
