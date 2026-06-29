---
type: module
path: '@root/src/protocol/schema/ids.ts'
fidelity: Active
domain: '[[Worker]]'
grammar: '[[grammar/typescript]]'
depth_score: 0.82
depth_status: DEEP
tags: [module, deep]
aliases: [ids, protocol-ids]
---

# Protocol IDs

## Purpose

Branded string identifiers for every ACP entity. Branding makes a `WorkId`
unassignable to a `WorkerId` at compile time, eliminating a whole class of
mix-up bugs. One thin surface (`Schema.String + brand`) hides real type safety.

## Interface

### Signatures

```typescript
export const WorkId: Schema.brand<Schema.SchemaClass<string>, 'WorkId'>
export type WorkId = typeof WorkId.Type
// …WorkerId, WorkspaceId, LeaseId, ArtifactId, CheckpointId, MemoryId, ReviewId, EventId, SessionId
```

### Governance

- Every entity reference in any schema uses the branded ID, never raw `string`.

### Linkage

- **Requires:** `effect` Schema ([[grammar/typescript]])
- **Consumed by:** every `*.schema.ts`

## Algorithm

`Schema.String.pipe(Schema.brand("<Name>"))` per identifier. No runtime format
constraint in v0.1 (host assigns IDs); brand is compile-time only.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT use raw `string` for an entity reference anywhere in domain/schema code.
- ❌ Do NOT construct an ID by casting — decode through the schema.

## Depth

DEEP (0.82). Trivial implementation, but deletion scatters type-safety loss across
every schema. Pure leverage via the type system.

## Referenced by

[[common]] · [[worker.schema]] · [[work-unit.schema]] · [[event.schema]] · [[src/_MOC]]
