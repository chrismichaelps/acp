---
type: module
path: '@root/src/app/server/resume-routes.ts'
fidelity: Active
domain: '[[WorkUnit]]'
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.7
depth_status: DEEP
tags: [module, seam, deep]
aliases: [resume-routes, work-resume-routes]
---

# Resume Routes

## Purpose

Expose work-scoped read endpoints for handoff and recovery. These handlers turn
the existing domain read capabilities into transport responses so a worker can
reconstruct a [[WorkUnit]]'s current resume packet without replaying the entire
[[Event]] stream client-side.

## Interface

```typescript
export const getWork: HttpRouter handler
export const listWorkCheckpoints: HttpRouter handler
export const latestWorkCheckpoint: HttpRouter handler
export const listWorkArtifacts: HttpRouter handler
```

### Routes

- `GET /v1/work/{work_id}` → [[WorkUnit]]
- `GET /v1/work/{work_id}/checkpoints` → newest-first [[Checkpoint]][]
- `GET /v1/work/{work_id}/checkpoints/latest` → latest [[Checkpoint]]
- `GET /v1/work/{work_id}/artifacts` → [[Artifact]][]

## Algorithm

Each handler reads `work_id`, authorizes `workspace:read`, verifies the
[[WorkUnit]] exists through [[work-unit-service]], then delegates to the matching
domain read method and schema-encodes the response. List endpoints return empty
arrays for existing work with no checkpoints or artifacts. The latest-checkpoint
endpoint returns `404 not_found` when the work exists but no checkpoint has been
published.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT duplicate checkpoint or artifact filtering in the router.
- ❌ Do NOT expose workspace-wide lists in this first slice; keep the resume packet
  work-scoped.
- ❌ Do NOT bypass [[route-support]] authorization or error folding.

## Depth

DEEP (0.7). A narrow handler module hides work-existence checks, read
authorization, and response encoding for the resume surface while keeping
[[acp-router]] under the file-size gate.

## Referenced by

[[acp-router]] · [[route-support]] · [[server/_MOC]]
