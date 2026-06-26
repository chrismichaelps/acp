---
type: module
path: "@root/src/protocol/schema/work-unit.schema.ts"
fidelity: Active
domain: "[[WorkUnit]]"
grammar: "[[grammar/typescript]]"
seam: "[[Storage]]"
depth_score: 0.66
depth_status: MEDIUM
tags: [module, medium]
aliases: [work-unit.schema]
---

# Work Unit Schema

## Purpose
Wire + domain shape of a [[WorkUnit]] (spec §10.3), plus the `CreateWork` and
`ClaimWork` request payloads decoded at the transport edge.

## Interface
### Signatures
```typescript
export const WorkUnit: Schema.Struct<{
  id: WorkId; workspace_id: WorkspaceId; title: NonEmptyString
  description: optionalWith<string, Option>; state: WorkState; priority: Priority
  created_by: WorkerId; assigned_to: optionalWith<WorkerId, Option>
  created_at: Timestamp; updated_at: Timestamp
}>
export const CreateWorkPayload: Schema.Struct<{
  workspace_id; title; description?; priority? }>
export const ClaimWorkPayload: Schema.Struct<{ worker_id: WorkerId }>
export type WorkUnit = typeof WorkUnit.Type
```

## Algorithm
Struct over [[ids]] + [[common]]. `state` is the [[WorkUnit]] state-machine literal;
`assigned_to` is `Option`. Payload schemas are the decode targets for `POST /v1/work`
and `/claim` (spec §12.3–12.4).

## Negative Logic (Prohibited Paths)
- ❌ Do NOT mutate `state` outside the [[WorkUnit]] state machine — invalid transitions are `InvalidStateTransitionError`.
- ❌ Do NOT default `priority` in the schema to anything but `normal`.

## Depth
MEDIUM (0.66). The closed `state` vocabulary + payload schemas hide the protocol's
work contract behind one decode point.

## Referenced by
[[event.schema]] · [[Storage]] · [[src/_MOC]]
