---
type: module
path: "@root/src/protocol/schema/workspace.schema.ts"
fidelity: Active
domain: "[[Workspace]]"
grammar: "[[grammar/typescript]]"
depth_score: 0.55
depth_status: MEDIUM
tags: [module, medium]
aliases: [workspace.schema]
---

# Workspace Schema

## Purpose
Wire + domain shape of a [[Workspace]] (spec §10.2).

## Interface
### Signatures
```typescript
export const Workspace: Schema.Struct<{
  id: WorkspaceId; name: NonEmptyString; kind: WorkspaceKind
  uri: NonEmptyString; default_branch: optionalWith<string, Option>
  metadata: Schema.Record<string, string>
}>
export type Workspace = typeof Workspace.Type
```

## Algorithm
Struct over [[ids]] + [[common]] `WorkspaceKind`. `default_branch` is `Option`
(may be absent for non-Git workspaces). `metadata` is an open string map.

## Negative Logic (Prohibited Paths)
- ❌ Do NOT assume `default_branch` is present — it is `Option` (Git-aware, not Git-dependent).

## Depth
MEDIUM (0.55). Data shape; Git-neutrality encoded via optional branch.

## Referenced by
[[src/_MOC]]
