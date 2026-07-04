---
type: module
path: '@root/src/app/server/resource-workspace-auth.ts'
fidelity: Active
domain: '[[Workspace]]'
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.67
depth_status: SUPPORTING
tags: [module, auth, tenancy]
aliases: [resource-workspace-auth]
---

# Resource Workspace Auth

## Purpose

Centralize HTTP authorization for mutation routes whose tenant is not present as
a request field. The router supplies a resource id, this module loads the owning
record, derives its `workspace_id`, and then delegates the final permission plus
workspace binding check to [[route-support]] `authorizeWorkspace`.

## Interface

The exported helpers are intentionally short because [[acp-router]] sits on the
500-line file-size boundary. `w`, `l`, `a`, and `r` authorize work, lease,
artifact, and review targets respectively. `rr` authorizes review creation from
the request's `work_id`. Each helper returns the authorized actor and the loaded
resource when the route needs it for the subsequent service call.

## Algorithm

Each helper performs the same three-step boundary protocol: load the resource
through its domain service, map an absent resource to the canonical `NotFoundError`,
then call `authorizeWorkspace(scope, workspace_id)`. Review authorization loads
the review first and then the owning work unit because the review record stores
`work_id` rather than a duplicated workspace id.

The helper authorizes before the route mutates state. That ordering matters for
tenant safety: a bearer session with the right action scope but the wrong
workspace binding receives `403 forbidden` before claim, transition, lease,
artifact, or review services are invoked.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT duplicate workspace derivation in the individual router handlers.
- ❌ Do NOT add workspace ids to review records only to simplify authorization.
- ❌ Do NOT collapse missing resources into forbidden; not-found semantics remain
  canonical when the caller is otherwise authorized for the target workspace.

## Referenced by

[[acp-router]] · [[route-support]]
