---
type: module
path: '@root/src/infrastructure/rpc/rpc-auth.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.7
depth_status: DEEP
tags: [module, deep, rpc, auth]
aliases: [rpc-auth]
---

# RPC Auth

## Purpose

Preserve ACP bearer-session authorization for native Effect RPC handlers and
[[rpc-auth-middleware]]. The module owns both the raw bearer helper and the
middleware-aware actor bridge: handlers can prefer an `AcpRpcActor` already
provided by `@effect/rpc` middleware, then fall back to header-based
authorization for direct `accessHandler` tests. The underlying policy resolves
the actor through [[session-service]], enforces optional permission scopes, and
preserves the local no-token `worker_system` fallback unless
`ACP_REQUIRE_AUTH=true`.

## Interface

```typescript
export interface AuthorizedRpcActor {
  readonly worker_id: WorkerId
  readonly permissions: readonly Permission[]
  readonly workspace_ids: Session['workspace_ids']
}

export const authorizeRpcActor: (
  headers: Headers,
  scope?: Permission,
) => Effect<AuthorizedRpcActor, ProtocolError, AppConfigTag | SessionService>

export const authorizeRpc: (
  headers: Headers,
  scope?: Permission,
) => Effect<WorkerId, ProtocolError, AppConfigTag | SessionService>

export const authorizeRpcWorkspace: (
  headers: Headers,
  scope: Permission,
  workspaceId: WorkspaceId,
) => Effect<WorkerId, ProtocolError, AppConfigTag | SessionService>

export const rpcActor: (
  headers: Headers,
  scope?: Permission,
) => Effect<WorkerId, ProtocolError, AppConfigTag | SessionService>

export const rpcWorkspaceActor: (
  headers: Headers,
  scope: Permission,
  workspaceId: WorkspaceId,
) => Effect<WorkerId, ProtocolError, AppConfigTag | SessionService>

export const AcpRpcActor: Context.Tag<WorkerId>
```

## Algorithm

Read `Authorization: Bearer <session_id>` from the RPC handler options headers.
When no token is present, read [[app-config]] and either fail with
`unauthorized` in required-auth mode or return `worker_system` in local mode.
When a token is present, load the session, fail `unauthorized` if it is missing,
and enforce the requested scope against the session permission list.
`authorizeRpcActor` preserves the resolved worker id, permission list, and
ADR-0009 workspace binding so `authorizeRpcWorkspace` can reject a valid session
whose `workspace_ids` do not contain the requested workspace. A valid session
that lacks either the requested scope or workspace binding fails `forbidden`
(403, spec §15), mirroring [[route-support]]: credential failures are 401,
authorization denials are 403.

`rpcActor` first checks whether `AcpRpcActor` exists in the current Effect
context. When native RPC is executed through [[rpc-auth-middleware]], that actor
has already passed the contract-level scope check, so handlers can use it
without reparsing headers. When a direct `accessHandler` test runs without
middleware, `rpcActor` delegates to `authorizeRpc`, preserving the old test and
fallback behavior.

`rpcWorkspaceActor` follows the same middleware-aware shape. If an `AcpRpcActor`
is already present, the handler treats it as a host-level actor supplied by the
middleware layer. Otherwise it delegates to `authorizeRpcWorkspace` and enforces
both the action scope and concrete workspace binding from the bearer session.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT log or return bearer tokens.
- ❌ Do NOT invent RPC-specific permission names; use [[common]] scopes.
- ❌ Do NOT duplicate token/session logic inside individual RPC handlers or
  middleware wrappers; both should delegate here.

## Depth

DEEP (0.7). A tiny interface hides the auth/session policy that every native RPC
handler must share.

## Referenced by

[[acp-rpc-handlers]] · [[rpc-auth-middleware]] ·
[[acp-rpc-direct-workspace-scope.test]] · [[acp-rpc-review-scope.test]] ·
[[acp-rpc-work-lease-scope.test]] · [[rpc-index]] · [[rpc/_MOC]]
