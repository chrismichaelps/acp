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
export const WorkspacePath: Schema.Struct<{ workspace_id: WorkspaceId }>
export const WorkerPath: Schema.Struct<{ worker_id: WorkerId }>
export const UpdateWorkStatePayload: Schema.Struct<{ state: WorkState }>
export const WorkProgressEventType: Schema.Literal<['work.progressed']>
export const PublishWorkEventPayload: Schema.Struct<{ type: WorkProgressEventType; data: Record<string, unknown> }>
export const ApproveReviewPayload: Schema.Struct<{
  met_requirements: string[]
  approval_signature?: ReviewApprovalSignature
}>
export const ArtifactContentResponse: Schema.Struct<{ content: string }>
export const RenewLeasePayload: Schema.Struct<{ ttl_seconds?: Positive }>
export const ClientCapabilities: Schema.Struct<{ // spec §9 worker flags }>
export const InitializeSessionWorker: Schema.Struct<{ // Worker descriptor, status/capabilities defaulted }>
export const InitializeSessionPayload: Schema.Struct<{ // §8 scopes default to []
  protocol_version: string; worker: InitializeSessionWorker
  capabilities: ClientCapabilities; permissions: SessionPermissions }>
export const InitializeSessionResponse: Schema.Struct<{ // spec §9 host handshake
  session_id: SessionId; protocol_version: "0.1"
  host: { name: string; kind: "local" }
  capabilities: { supports_events; supports_reviews; supports_signed_review_approvals; supports_artifacts; supports_sse: boolean }
  permissions: SessionPermissions
  workspace_ids: Option.Option<readonly WorkspaceId[]> }>

export const WorkGroup: HttpApiGroup.HttpApiGroup<'work', ...>
export const WorkerGroup: HttpApiGroup.HttpApiGroup<'workers', ...>
export const LeaseGroup: HttpApiGroup.HttpApiGroup<'leases', ...>
export { EventsGroup } from './acp-http-api-events.js'
export { ReviewGroup, ReviewCommentGroup, GrillGroup } from './acp-http-api-reviews.js'
export class AcpHttpApi extends HttpApi.make('acp').add(...) {}
```

### Routes

- `POST /v1/session/initialize`
- `GET /v1/workers`
- `GET /v1/workers/{worker_id}`
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
- `GET /v1/leases?workspace_id=...`
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
- `POST /v1/reviews/{review_id}/cancel`
- `POST` + `GET /v1/reviews/{review_id}/comments`
- `POST /v1/review-comments/{comment_id}/resolve`
- `POST /v1/review-comments/{comment_id}/reopen`
- `POST /v1/review-comments/{comment_id}/external-id`
- `GET /v1/work/{work_id}/review-comments`
- `POST /v1/reviews/{review_id}/grill`
- `GET /v1/reviews/{review_id}/grills`
- `POST /v1/grills/{grill_id}/questions`
- `POST /v1/grills/{grill_id}/evaluate`
- `GET /v1/grills/{grill_id}`
- `POST /v1/grill-questions/{question_id}/answer`
- `POST /v1/grill-questions/{question_id}/verdict`
- `GET /v1/events?workspace_id=...&after_seq=...&limit=...`
- `GET /v1/events/stream?workspace_id=...`

### Linkage

- **Requires:** [[work-unit.schema]], [[worker.schema]], [[workspace.schema]],
  [[session.schema]],
  [[acp-http-api-resume]],
  [[acp-http-api-reviews]],
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

The permission field reuses [[session.schema]] `SessionPermissions`. Either
ADR-0013 scope is valid alone; a payload containing both is rejected before a
session id is minted with the issue `review:respond and review:collaborate are
mutually exclusive`. This is a per-session least-privilege rule, not a trusted
issuer or cross-token identity guarantee.

The successful response applies the same [[session.schema]]
`SessionPermissions` refinement and echoes the exact decoded `permissions`
beside `workspace_ids`. Response decoding therefore rejects the dual-scope pair
instead of treating the success side as an unrefined `Permission[]`. This
additive field lets REST, native RPC, JSON-RPC HTTP/WebSocket, and [[stdio-main]]
prove that a valid closed-vocabulary permission array was accepted and preserved
instead of inferring codec success from a minted id. It is a truthful handshake
echo of the stored session, not an additional grant.

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

Worker reads are declared as host-scoped presence extensions over
[[worker-service]] `list` and `get`. They expose current registry state without
adding worker presence events to the workspace event log.

Event replay reads are declared as backed recovery extensions over
[[event-store]] `readAfter` through [[acp-http-api-events]]. The query shape
mirrors the storage scan key: workspace id plus a non-negative sequence cursor,
with an optional positive limit for bounded recovery tails. Live SSE remains on
`/v1/events/stream`.

Review cancellation is declared beside the existing review outcome routes as
`POST /v1/reviews/{review_id}/cancel`. It is a withdrawal command, not a
rejection alias, and is backed by [[review-service]] `cancel` plus
`review.cancelled`.

Review approval accepts optional `approval_signature` evidence. The payload is
schema-validated and forwarded to [[review-service]], which stores and emits the
evidence without host-side cryptographic verification.
The host capability descriptor advertises this as
`supports_signed_review_approvals: true` so clients can discover evidence
support without inferring it from broad review support.

Review, review-comment, and grill declarations are split into
[[acp-http-api-reviews]] so the typed inventory matches every production `/v1`
registration without pushing this central declaration beyond the file-size gate.
Adding the previously omitted 13 declarations is additive documentation of live
v0.1 behavior, not a new route or protocol-version change.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT implement business logic here.
- ❌ Do NOT use Express/Fastify/raw Node `http`; this module is Effect Platform only.
- ❌ Do NOT duplicate domain state machines; import schemas from protocol modules.
- ❌ Do NOT omit or reorder effective permission literals in the session
  response; propagation tests compare the exact array.
- ❌ Do NOT accept both ADR-0013 role scopes in one initialization payload.
- ❌ Do NOT publish a typed inventory that is smaller than [[acp-router]]'s
  production `/v1` registrations.

## Depth

MEDIUM (0.68). Mostly declarative, but centralizing the wire contract prevents
route drift between server handlers, generated clients, and tests.

## Referenced by

[[http-index]] · [[acp-http-api-events]] · [[acp-http-api.test]] · [[Transport]]
· [[workspace-routes]] · [[event-routes]] · [[protocol-version]] · [[src/_MOC]]
· [[ADR-0013-review-collaboration-permission]]
· [[acp-http-api-reviews]] · [[ADR-0017-openapi-contract-artifact]]
