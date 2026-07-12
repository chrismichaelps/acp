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
[[Event]] stream client-side. The same module also exposes host-stored artifact
content by artifact id, because artifact metadata uses `acp://artifacts/{id}` as
the public handle for private content stored by [[artifact-service]].

## Interface

```typescript
export const getWork: HttpRouter handler
export const getWorkResumePacket: HttpRouter handler
export const listWorkCheckpoints: HttpRouter handler
export const latestWorkCheckpoint: HttpRouter handler
export const listWorkArtifacts: HttpRouter handler
export const listWorkReviews: HttpRouter handler
export const getArtifactContent: HttpRouter handler
```

### Routes

- `GET /v1/work/{work_id}` → [[WorkUnit]]
- `GET /v1/work/{work_id}/resume` → compact resume packet (`work`,
  `latest_checkpoint`, `artifacts`, `reviews`, `open_comments`, `latest_grill`,
  optional `elided`). Carries an `ETag`; `If-None-Match` yields `304`. Accepts
  `?budget=N` for a salience-bounded view (see [[resume-workspace]]).
- `GET /v1/work/{work_id}/checkpoints` → newest-first [[Checkpoint]][]
- `GET /v1/work/{work_id}/checkpoints/latest` → latest [[Checkpoint]]
- `GET /v1/work/{work_id}/artifacts` → [[Artifact]][]
- `GET /v1/work/{work_id}/reviews` → [[Review]][]
- `GET /v1/artifacts/{artifact_id}/content` → `{ content: string }`

## Algorithm

Each handler reads `work_id`, authorizes `workspace:read`, verifies the
[[WorkUnit]] exists through [[work-unit-service]], then delegates to the matching
domain read method and schema-encodes the response. `getWorkResumePacket`
combines the current work record, latest checkpoint (optional), artifact
metadata, and review records into one response so a resuming agent does not need
four separate reads. It also surfaces the review-gate backlog: `open_comments`
is the `open`-state slice of [[review-comment-service]] `listForWork`, and
`latest_grill` is the newest [[Grill]] (by `created_at`) across the work's
reviews via [[grill-service]] `listForReview` — `Option.none` when the work has
no grills. List endpoints return empty arrays for existing work with
no checkpoints, artifacts, or reviews. The latest-checkpoint endpoint returns
`404 not_found` when the work exists but no checkpoint has been published.

`getWorkResumePacket` also shapes the packet as a bounded global workspace via
[[resume-workspace]]. It encodes the full packet, derives a stable `sha256`
`ETag` over that encoding plus the `?budget=` value, and returns `304 Not
Modified` (empty body, same `ETag`) when the request's `If-None-Match` matches —
write-once-read-many revalidation instead of re-downloading. With `?budget=N` it
inlines the `N` most salient (most-recent) artifacts and reviews and moves the
remainder to `elided: { artifacts?, reviews? }` reference sets. Budgeting is
opt-in and never drops gate-critical reviews (an `approved` review and the one
tied to `latest_grill` are pinned), so a budgeted packet cannot flip the merge
gate; `open_comments`, `latest_grill`, `work`, and `latest_checkpoint` are never
budgeted.

`getArtifactContent` reads `artifact_id`, authorizes `workspace:read`, verifies
the [[Artifact]] metadata exists, then returns host-stored content when present.
External artifact references and deleted/missing artifacts return `404
not_found`; callers should follow the artifact metadata URI for external
systems.

Each handler passes its stable route template to [[route-support]] `respond` so
read-path telemetry records route/status/duration without logging work or
artifact identifiers.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT duplicate checkpoint or artifact filtering in the router.
- ❌ Do NOT expose workspace-wide lists in this first slice; keep the resume packet
  work-scoped.
- ❌ Do NOT expose artifact content through event payloads or artifact metadata
  lists.
- ❌ Do NOT bypass [[route-support]] authorization or error folding.

## Depth

DEEP (0.7). A narrow handler module hides work-existence checks, read
authorization, and response encoding for the resume surface while keeping
[[acp-router]] under the file-size gate.

## Referenced by

[[resume-routes.test]] · [[resume-workspace-routes.test]] · [[acp-router]] ·
[[route-support]] · [[server/_MOC]]
