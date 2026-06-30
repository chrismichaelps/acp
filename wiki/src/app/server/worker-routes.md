---
type: module
path: '@root/src/app/server/worker-routes.ts'
fidelity: Active
domain: '[[Worker]]'
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.66
depth_status: MEDIUM
tags: [module, seam, medium]
aliases: [worker-routes]
---

# Worker Routes

## Purpose

Expose host-scoped [[Worker]] registry reads without turning presence into
workspace event history. These routes let clients inspect current worker records
and statuses through [[worker-service]] while preserving
[[ADR-0005-worker-presence-scope]]: presence is registry state, not a
workspace-scoped [[Event]] stream.

## Interface

```typescript
export const listWorkers: Effect<
  HttpServerResponse,
  never,
  WorkerService | AppConfigTag | SessionService | HttpServerRequest
>
export const getWorker: Effect<
  HttpServerResponse,
  never,
  | WorkerService
  | AppConfigTag
  | SessionService
  | HttpServerRequest
  | HttpRouter.RouteContext
>
```

### Routes

- `GET /v1/workers` → `worker:read`
- `GET /v1/workers/{worker_id}` → `worker:read`

### Linkage

- **Requires:** [[worker-service]], [[route-support]], [[worker.schema]],
  [[common]], [[protocol-error]]
- **Consumed by:** [[acp-router]]

## Algorithm

`listWorkers` authorizes `worker:read`, delegates to [[worker-service]] `list`,
and encodes `Worker[]`. `getWorker` authorizes `worker:read`, reads `worker_id`
from the path, delegates to `WorkerService.get`, maps absence to `NotFoundError`,
and encodes the `Worker`. Both handlers pass stable route templates to
[[route-support]] `respond` so host-presence telemetry avoids raw worker ids.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT emit `worker.online`, `worker.offline`, or `worker.status_changed`
  into [[event-store]].
- ❌ Do NOT require a `workspace_id`; worker presence is host-scoped.
- ❌ Do NOT duplicate worker storage decoding in route code.

## Depth

MEDIUM (0.66). The module is intentionally thin transport projection, but it
keeps host presence reads centralized and separate from workspace routes/events.

## Referenced by

[[acp-router]] · [[server/_MOC]] · [[ADR-0005-worker-presence-scope]]
