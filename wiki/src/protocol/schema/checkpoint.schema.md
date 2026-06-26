---
type: module
path: "@root/src/protocol/schema/checkpoint.schema.ts"
fidelity: Active
domain: "[[Checkpoint]]"
grammar: "[[grammar/typescript]]"
depth_score: 0.55
depth_status: MEDIUM
tags: [module, medium]
aliases: [checkpoint.schema]
---

# Checkpoint Schema

## Purpose
Wire + domain shape of a [[Checkpoint]] and its create payload (spec §10.6, §12.10).

## Interface
### Signatures
```typescript
export const Checkpoint: Schema.Struct<{
  id: CheckpointId; work_id: WorkId; workspace_id: WorkspaceId; created_by: WorkerId
  summary: NonEmptyString; completed_steps: Schema.Array<string>
  remaining_steps: Schema.Array<string>; modified_resources: Schema.Array<string>
  created_at: Timestamp
}>
export const CreateCheckpointPayload: Schema.Struct<{
  workspace_id; work_id; summary; completed_steps; remaining_steps; modified_resources }>
export type Checkpoint = typeof Checkpoint.Type
```

## Algorithm
Struct over [[ids]] + [[common]]. Step/resource lists decode as arrays at the edge;
domain may hold them as `Chunk` (spec §16.7).

## Negative Logic (Prohibited Paths)
- ❌ Do NOT overwrite prior checkpoints — they are append-only resume points.

## Depth
MEDIUM (0.55).

## Referenced by
[[event.schema]] · [[src/_MOC]]
