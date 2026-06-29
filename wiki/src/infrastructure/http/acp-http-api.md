---
type: module
path: '@root/src/infrastructure/http/acp-http-api.ts'
fidelity: Active
domain: '[[WorkUnit]]'
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.68
depth_status: MEDIUM
tags: [module, seam, medium]
aliases: [acp-http-api, AcpHttpApi]
---

# ACP HTTP API

## Purpose

Declare the v0.1 REST contract for the [[Transport]] seam using
`@effect/platform` `HttpApi`, `HttpApiGroup`, and `HttpApiEndpoint`. This module
is declarative only: it names routes, request payload schemas, path/query schemas,
success schemas, and protocol error schemas. Handler implementation and server
wiring land in a later slice.

## Interface

### Signatures

```typescript
export const WorkPath: Schema.Struct<{ work_id: WorkId }>
export const LeasePath: Schema.Struct<{ lease_id: LeaseId }>
export const ArtifactPath: Schema.Struct<{ artifact_id: ArtifactId }>
export const EventsStreamParams: Schema.Struct<{ workspace_id: WorkspaceId }>
export const WorkspacePath: Schema.Struct<{ workspace_id: WorkspaceId }>
export const UpdateWorkStatePayload: Schema.Struct<{ state: WorkState }>
export const PublishWorkEventPayload: Schema.Struct<{ type: EventType; data: Record<string, unknown> }>
export const ApproveReviewPayload: Schema.Struct<{ met_requirements: string[] }>
export const ArtifactContentResponse: Schema.Struct<{ content: string }>
export const RenewLeasePayload: Schema.Struct<{ ttl_seconds?: Positive }>
export const ClientCapabilities: Schema.Struct<{ // spec §9 worker flags }>
export const InitializeSessionWorker: Schema.Struct<{ // Worker descriptor, status/capabilities defaulted }>
export const InitializeSessionPayload: Schema.Struct<{ // §8 scopes default to []
  protocol_version: string; worker: InitializeSessionWorker
  capabilities: ClientCapabilities; permissions: Schema.Array<Permission> }>
export const InitializeSessionResponse: Schema.Struct<{ // spec §9 host handshake
  session_id: SessionId; protocol_version: "0.1"
  host: { name: string; kind: "local" }
  capabilities: { supports_events; supports_reviews; supports_artifacts; supports_sse: boolean } }>

export const WorkGroup: HttpApiGroup.HttpApiGroup<'work', ...>
export const LeaseGroup: HttpApiGroup.HttpApiGroup<'leases', ...>
export const EventsGroup: HttpApiGroup.HttpApiGroup<'events', ...>
export class AcpHttpApi extends HttpApi.make('acp').add(...) {}
```

### Routes

- `POST /v1/session/initialize`
- `GET /v1/workspaces`
- `POST /v1/workspaces`
- `PATCH /v1/workspaces/{workspace_id}`
- `POST /v1/workspaces/{workspace_id}/archive`
- `GET /v1/workspaces/{workspace_id}/work`
- `GET /v1/workspaces/{workspace_id}/checkpoints`
- `GET /v1/workspaces/{workspace_id}/artifacts`
- `GET /v1/workspaces/{workspace_id}/reviews`
- `POST /v1/work`
- `GET /v1/work/{work_id}`
- `POST /v1/work/{work_id}/claim`
- `PATCH /v1/work/{work_id}`
- `POST /v1/work/{work_id}/events`
- `GET /v1/work/{work_id}/checkpoints`
- `GET /v1/work/{work_id}/checkpoints/latest`
- `GET /v1/work/{work_id}/artifacts`
- `GET /v1/work/{work_id}/reviews`
- `POST /v1/leases`
- `POST /v1/leases/{lease_id}/renew`
- `POST /v1/leases/{lease_id}/release`
- `POST /v1/leases/{lease_id}/revoke`
- `POST /v1/artifacts`
- `PATCH /v1/artifacts/{artifact_id}`
- `DELETE /v1/artifacts/{artifact_id}`
- `GET /v1/artifacts/{artifact_id}/content`
- `POST /v1/checkpoints`
- `POST /v1/reviews`
- `POST /v1/reviews/{review_id}/approve`
- `POST /v1/reviews/{review_id}/reject`
- `POST /v1/reviews/{review_id}/request_changes`
- `GET /v1/events/stream?workspace_id=...`

### Linkage

- **Requires:** [[work-unit.schema]], [[worker.schema]], [[workspace.schema]],
  [[lease.schema]], [[artifact.schema]], [[checkpoint.schema]], [[review.schema]],
  [[event.schema]], [[error.schema]]
- **Consumed by:** future HTTP handler/server layer and generated clients.

## Algorithm

No runtime behavior. Build groups with `HttpApiGroup.make`, add endpoints with
`HttpApiEndpoint.get/post/patch`, attach path params with `HttpApiSchema.param`,
payloads with `setPayload`, query params with `setUrlParams`, and successes/errors
with `addSuccess`/`addError`.

`InitializeSessionPayload` accepts both the original implementation shape (a full
[[Worker]] record with `status` and `capabilities`) and the draft spec §9 shape:
`protocol_version`, a lean worker descriptor, and a top-level client capability
object. Defaults keep reconnects compact while the router normalizes the decoded
descriptor back into a canonical [[Worker]] for storage. The request schema keeps
the client version as a string; [[protocol-version]] owns the supported-version
predicate so the router can reject incompatible versions as explicit handshake
validation rather than generic decode failure.

Artifact update/delete are declared as backed extensions because the domain
[[artifact-service]] owns mutation/removal and emits `artifact.updated` and
`artifact.deleted`.

Work resume reads are declared as backed extensions because [[work-unit-service]],
[[checkpoint-service]], and [[artifact-service]] already own the domain read
semantics required for handoff: current work metadata, newest-first checkpoints,
latest checkpoint, and work artifacts.
The second resume-read slice adds current review gates and host-stored artifact
content reads so a worker can reconstruct both the human review state and any
private patch/log/markdown artifact content.

Workspace create/update/archive are declared as backed extensions beside `GET
/v1/workspaces`. The [[workspace-service]] owns persisted `workspace.created`,
`workspace.updated`, and `workspace.archived` events, so the transport exposes
`POST /v1/workspaces`, `PATCH /v1/workspaces/{workspace_id}`, and
`POST /v1/workspaces/{workspace_id}/archive`.
Workspace work indexing is a backed read extension over [[work-unit-service]]
`listForWorkspace`, giving new workers the current WorkUnit ids for a workspace
before they call work-scoped resume endpoints.
Workspace aggregate resume reads are backed extensions over
[[checkpoint-service]], [[artifact-service]], and [[review-service]]
`listForWorkspace`, giving dashboards and supervising agents a workspace-level
view of resumability evidence without iterating every WorkUnit id.

Lease renew/revoke are declared as backed lifecycle extensions because
[[lease-service]] already owns `renew`/`revoke` state transitions and emits
`lease.renewed`/`lease.revoked`. `RenewLeasePayload` accepts an optional positive
TTL override; omitting it delegates to the host default lease TTL.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT implement business logic here.
- ❌ Do NOT use Express/Fastify/raw Node `http`; this module is Effect Platform only.
- ❌ Do NOT duplicate domain state machines; import schemas from protocol modules.

## Depth

MEDIUM (0.68). Mostly declarative, but centralizing the wire contract prevents
route drift between server handlers, generated clients, and tests.

## Referenced by

[[http-index]] · [[Transport]] · [[workspace-routes]] · [[protocol-version]] ·
[[src/_MOC]]
