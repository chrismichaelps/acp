---
type: adr
status: ACCEPTED
date: 2026-07-04
tags: [adr, auth, multi-tenancy, workspace, hosted]
aliases: [ADR-0009, ADR-0009-workspace-scoped-sessions]
---

# ADR-0009 — Workspace-Scoped Sessions for Hosted ACP

## Status

ACCEPTED — 2026-07-04. This ADR completes the Identity/Auth seam left open by
[[ADR-0008-deployment-storage-topology]]. Implementation is staged after this
decision because it changes the session model and every authorization boundary.

## Context

ACP already treats `workspace_id` as the tenant boundary for durable coordination:
work units, leases, events, memory, artifacts, checkpoints, and review gates all
derive or carry workspace identity. The current bearer session does not. A
session stores only `worker_id`, `created_at`, and permission scopes, so any valid
authenticated session with `workspace:read`, `work:create`, or similar permission
can operate against any workspace id supplied in a route payload.

That is acceptable for `local` and most `single-node` self-hosted deployments,
where the process and database are already tenant-specific. It is not acceptable
for the `hosted` topology from ADR-0008, where one ACP host and database serve
many tenants. In that topology, the bearer token must identify both what the
caller may do and which workspace set the caller may do it in.

The design has to cover both HTTP and native RPC. HTTP authorization currently
resolves a bearer session in [[route-support]] and checks a permission. Native RPC
does the same in [[rpc-auth]]. Both return a worker actor to the handler, while
the target workspace is often known only after decoding a path parameter, request
body, or domain object such as a review's work unit.

## Decision

Sessions gain an optional workspace binding. Permission scopes keep their current
meaning; workspace bindings narrow where those permissions apply.

### Session shape

Add `workspace_ids: Option<readonly WorkspaceId[]>` to the stored `Session`.
`None` means host-wide authority and preserves the current local/single-node
behavior. `Some([])` is invalid at session creation because it would mint a
credential that can never authorize tenant-scoped work. `Some([id, ...])` means
the session is authorized only for those workspace ids.

The binding is part of the session record, not an external lookup hidden inside
the transport. This keeps every transport consistent and lets the storage-backed
session registry remain the source of truth for bearer authorization.

### Session initialization

`session.initialize` remains the open bootstrap route. It accepts an optional
`workspace_ids` field in hosted-capable profiles. For local/single-node profiles,
omitting the field yields a host-wide session. For hosted profiles, omitting the
field is rejected unless a future token resolver supplies workspace bindings
before the session is stored.

This binding check does not make the open bootstrap a trusted issuer. The v0.1
client still selects its worker id, permission literals, and workspace ids; a
binding limits where the resulting session acts but does not prove entitlement
to that workspace. Public hosted issuance remains
[[ADR-0015-trusted-session-issuance]].

The first implementation may require explicit `workspace_ids` in the initialize
payload for `hosted` and `self-host-ha`; a later managed-service resolver can map
an external credential to workspace ids before calling the same session service.

### Authorization boundary

Replace permission-only authorization with an actor context:

```typescript
interface AuthorizedActor {
  readonly worker_id: WorkerId
  readonly permissions: readonly Permission[]
  readonly workspace_ids: Option.Option<readonly WorkspaceId[]>
}
```

`authorize(scope)` resolves the bearer session and checks permission exactly as
today, then returns `AuthorizedActor` instead of only `WorkerId`. A second helper,
`authorizeWorkspace(scope, workspaceId)`, checks both the permission and the
workspace binding. Native RPC mirrors the same split so generated clients and HTTP
routes cannot diverge.

Handlers should call the workspace-aware helper at the point where the target
workspace is known. For request payloads that include `workspace_id`, this happens
immediately after decoding. For derived resources, the handler first loads the
resource by id, derives its workspace, then checks the actor against that
workspace before returning or mutating it.

### Error semantics

Credential failures remain `401 unauthorized`: missing bearer token when auth is
required, invalid token, expired session.

Authorization failures on explicit workspace targets remain `403 forbidden`:
valid token with missing permission or valid token bound to a different
workspace. Error bodies must not disclose whether the forbidden workspace
exists.

Opaque resource-id targets need the stronger non-enumeration rule established
by [[ADR-0013-review-collaboration-permission]]: check the action scope before
lookup, then return the same `404 not_found` envelope for a missing resource and
an existing resource outside the session binding. Keep `403` for an in-binding
target when the session lacks the action scope. This specialization prevents a
404/403 status difference from disclosing resource existence across tenants.

### Profile behavior

`local` keeps auth off by default and host-wide sessions when a bearer token is
used. `single-node` may require auth but defaults to host-wide sessions because
the deployment is already isolated. `hosted` requires workspace-bound sessions.
`self-host-ha` uses the same workspace-bound mechanism when an operator enables
multi-tenant auth; otherwise it may run as a single-tenant host-wide deployment.

## Rationale

Workspace binding belongs on sessions because sessions are already the
transport-independent bearer credential. Adding a separate hosted-only
authorization store would split HTTP and RPC behavior, complicate tests, and make
local dogfood less representative of the hosted runtime.

`None` for host-wide authority is deliberate. It avoids forcing every existing
local test, CLI flow, and single-node deployment to invent a workspace list before
they can bootstrap a worker. Hosted mode can forbid `None` through config without
making the base protocol hostile to self-hosting.

Checking workspace scope after route decoding is more honest than trying to embed
workspace into permission names. Permissions answer "what action"; workspace
bindings answer "where." Keeping them orthogonal prevents a scope vocabulary
explosion such as `work:create:workspace_123` and preserves the current spec §8
permission table.

## Consequences

The session schema and stored session decoder need a backward-compatible decode
path for records minted before `workspace_ids` existed. Tests that construct
`Session` literals need to choose host-wide or workspace-bound authority
explicitly.

`authorize()` call sites will not all migrate mechanically. Some routes know the
workspace from the request body; others must load a work unit, artifact,
checkpoint, review, or memory query before the workspace check. Those handlers
need targeted tests proving a valid session for workspace A cannot read or mutate
workspace B.

Native RPC middleware cannot stop at permission metadata alone once workspace
scope is enforced. Handler-level checks remain necessary for methods whose
workspace is inside the payload or derived from another entity.

## Alternatives

**Keep only permission scopes** — rejected. It cannot support central hosted ACP
because any authenticated caller with a broad action scope can target another
tenant's workspace id.

**Encode workspace ids into permission strings** — rejected. It turns the stable
permission vocabulary into unbounded tenant data and makes scope matching
stringly-typed.

**Require exactly one workspace per session** — rejected for now. Multi-workspace
operators and reviewer agents are expected in hosted environments. A singleton
session is a policy a token issuer may choose, not a protocol limitation.

**Move workspace checks entirely into storage queries** — rejected. Storage should
remain a persistence seam, not the authorization policy engine. Authorization
must fail before business mutations and before handlers reveal cross-tenant
existence details.

## Validation

Implementation must land in small slices: schema/session-service compatibility,
HTTP authorization helpers and route migration, native RPC authorization parity,
profile/config enforcement, then hosted/self-host-ha presets. Each slice must
include negative tests for cross-workspace access with a valid token and confirm
that local/single-node host-wide sessions remain compatible.

## Referenced by

[[ADR-0008-deployment-storage-topology]] · [[route-support]] · [[rpc-auth]]
· [[session-service]] · [[session.schema]] · [[decisions/_MOC]] ·
[[ADR-0013-review-collaboration-permission]]
