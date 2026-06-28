---
type: module
path: '@root/src/protocol/schema/worker.schema.ts'
fidelity: Active
domain: '[[Worker]]'
grammar: '[[grammar/typescript]]'
depth_score: 0.6
depth_status: MEDIUM
tags: [module, medium]
aliases: [worker.schema]
---

# Worker Schema

## Purpose

Wire + domain shape of a [[Worker]] and its capability set. Decodes session
`initialize` payloads and worker records.

## Interface

### Signatures

```typescript
export const Capability: Schema.Literal<
  [
    // declared capability flags
    'can_edit_files',
    'can_run_commands',
    'can_create_prs',
    'can_review',
    'supports_checkpoints',
    'supports_leases',
  ]
>
export const Worker: Schema.Struct<{
  id: WorkerId
  name: NonEmptyString
  kind: WorkerKind
  vendor: optional<string>
  status: WorkerStatus
  capabilities: Schema.Array<Capability>
}>
export type Worker = typeof Worker.Type
```

## Algorithm

Struct over [[ids]] + [[common]] unions. `capabilities` decoded as an array at the
wire edge; domain code converts to `HashSet` (spec §16.7) when indexing.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT trust `capabilities` from the wire — the [[Host]] treats workers as untrusted ([[Worker]]).

## Depth

MEDIUM (0.6). Mostly a data shape; depth comes from the closed capability vocabulary.

## Referenced by

[[event.schema]] · [[src/_MOC]]
