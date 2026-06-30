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
[[rpc-auth-middleware]]. The helper accepts Effect Platform `Headers`, resolves
the actor through [[session-service]], enforces optional permission scopes, and
preserves the local no-token `worker_system` fallback unless
`ACP_REQUIRE_AUTH=true`.

## Interface

```typescript
export const authorizeRpc: (
  headers: Headers,
  scope?: Permission,
) => Effect<WorkerId, ProtocolError, AppConfigTag | SessionService>
```

## Algorithm

Read `Authorization: Bearer <session_id>` from the RPC handler options headers.
When no token is present, read [[app-config]] and either fail with
`unauthorized` in required-auth mode or return `worker_system` in local mode.
When a token is present, load the session, fail `unauthorized` if it is missing,
and enforce the requested scope against the session permission list.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT log or return bearer tokens.
- ❌ Do NOT invent RPC-specific permission names; use [[common]] scopes.
- ❌ Do NOT duplicate token/session logic inside individual RPC handlers or
  middleware wrappers; both should delegate here.

## Depth

DEEP (0.7). A tiny interface hides the auth/session policy that every native RPC
handler must share.

## Referenced by

[[acp-rpc-handlers]] · [[rpc-auth-middleware]] · [[rpc-index]] · [[rpc/_MOC]]
