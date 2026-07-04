---
type: module
path: '@root/src/infrastructure/rpc/rpc-resource-workspace-auth.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.65
depth_status: SUPPORTING
tags: [module, rpc, auth, tenancy]
aliases: [rpc-resource-workspace-auth]
---

# RPC Resource Workspace Auth

## Purpose

Authorize native RPC handlers whose workspace is stored behind a resource id.
The helper loads the target work unit or lease, derives its `workspace_id`, and
then delegates to [[rpc-auth]] `rpcWorkspaceActor` so bearer sessions must hold
both the action permission and the tenant binding before a handler mutates or
reads the resource.

## Interface

`work(headers, scope, workId)` returns the authorized actor and loaded
[[work-unit-service]] record. `lease(headers, scope, leaseId)` returns the
authorized actor and loaded [[lease-service]] record. Both helpers map absent
resources through [[rpc-error]] to canonical `not_found` responses, while
workspace mismatches remain `forbidden`.

## Algorithm

The helpers intentionally authorize after loading the resource because the route
does not receive a workspace id. Host-wide sessions and middleware-provided
`AcpRpcActor` values retain the semantics defined in [[rpc-auth]]. Workspace-bound
bearer sessions must include the loaded resource's workspace id; otherwise the
handler fails before claim, state transition, event publication, lease renewal,
release, or revocation.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT duplicate resource loading in each work or lease RPC handler.
- ❌ Do NOT turn a valid cross-workspace request into `not_found`; the caller is
  authenticated but not authorized.
- ❌ Do NOT bypass [[rpc-auth]] workspace checks for by-id mutations.

## Referenced by

[[acp-rpc-handlers]] · [[rpc-auth]]
