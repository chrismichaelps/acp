---
type: module
path: '@root/src/protocol/schema/memory.schema.ts'
fidelity: Active
domain: '[[Memory]]'
grammar: '[[grammar/typescript]]'
depth_score: 0.7
depth_status: DEEP
tags: [module, deep, schema]
aliases: [memory.schema, MemorySchema]
---

# Memory Schema

## Purpose

Define the wire/domain shape for [[Memory]] records and create/list payloads.
The schema is the source of truth for TypeScript types and transport validation.

## Interface

```typescript
export const MemoryKind: Schema.Literal<...>
export const Memory: Schema.Struct<...>
export const CreateMemoryPayload: Schema.Struct<...>
export const ReadMemoryQuery: Schema.Struct<...>
```

## Algorithm

`Memory` carries host-assigned `id`, workspace-scoped `seq`, `created_by`, and
`created_at`; caller payloads provide workspace/work scope, kind, key, summary,
content, and labels. `ReadMemoryQuery` mirrors the hot storage path:
`workspace_id`, `after_seq`, optional `limit`, and optional filters for `work_id`,
`kind`, `key`, and `label`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT allow callers to provide `seq`, `created_by`, or `created_at`.
- ❌ Do NOT use Memory for large artifacts or binary data.
- ❌ Do NOT make `workspace_id` optional; Memory is always workspace-owned.

## Depth

DEEP (0.7). The schema hides the exact validation and optional-field encoding
behind a compact protocol object while preserving the optimized read contract.

## Referenced by

[[Memory]] · [[workspace-memory-records]] · [[src/_MOC]]
