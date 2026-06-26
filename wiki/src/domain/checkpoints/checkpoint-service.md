---
type: module
path: '@root/src/domain/checkpoints/checkpoint-service.ts'
fidelity: Active
domain: '[[Checkpoint]]'
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
depth_score: 0.72
depth_status: DEEP
tags: [module, deep]
aliases: [checkpoint-service, CheckpointService]
---

# Checkpoint Service

## Purpose

Own append-only [[Checkpoint]] persistence for v0.1. A Checkpoint is a resumable
progress summary for a [[WorkUnit]], so another [[Worker]] can resume after a
pause, crash, or handoff. The service stores checkpoints through [[Storage]],
emits `checkpoint.created` [[Event]] records through [[EventStore]], and exposes
the latest checkpoint as the work unit's current resume point.

## Interface

```typescript
export interface CreateCheckpointInput {
  readonly id: CheckpointId
  readonly payload: CreateCheckpointPayload
  readonly createdBy: WorkerId
  readonly now: Timestamp
}

export interface CheckpointServiceApi {
  readonly create: (
    input: CreateCheckpointInput,
  ) => Effect<Checkpoint, StorageError>
  readonly get: (
    checkpointId: CheckpointId,
  ) => Effect<Option<Checkpoint>, StorageError>
  readonly listForWork: (
    workId: WorkId,
  ) => Effect<readonly Checkpoint[], StorageError>
  readonly listForWorkspace: (
    workspaceId: WorkspaceId,
  ) => Effect<readonly Checkpoint[], StorageError>
  readonly latestForWork: (
    workId: WorkId,
  ) => Effect<Option<Checkpoint>, StorageError>
}
```

## Governance

- Checkpoints are append-only. This service has no update or delete method.
- The caller supplies `CheckpointId` and `Timestamp`, following existing domain
  service convention.
- Lists are returned newest-first so `latestForWork` is the first item.
- Every create persists state before emitting `checkpoint.created`.

## Algorithm

1. `create` builds a Checkpoint from the create payload, saves it, emits
   `checkpoint.created`, and returns the stored value.
2. `get` loads one Checkpoint; absence is `Option.none`.
3. `listForWork` and `listForWorkspace` decode all checkpoints, filter by scope,
   and sort newest-first by `created_at`.
4. `latestForWork` returns the first item from `listForWork`, or `Option.none`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT overwrite or delete prior checkpoints.
- ❌ Do NOT emit `checkpoint.created` before storage succeeds.
- ❌ Do NOT treat checkpoints as deliverables; use [[Artifact]] for outputs.

## Depth

DEEP (0.72). The service hides storage collection naming, schema encode/decode,
event emission, sorting, and latest-resume semantics behind one domain surface.

## Grill Log

- **Q:** Should Checkpoint support update or delete?
  **A:** No. The domain page and protocol principle make checkpoints append-only.
  A mistaken checkpoint can be superseded by a newer one without losing audit
  history.

## Referenced by

[[checkpoints/_MOC]] · [[Checkpoint]] · [[src/_MOC]]
