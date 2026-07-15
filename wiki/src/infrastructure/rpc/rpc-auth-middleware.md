---
type: module
path: '@root/src/infrastructure/rpc/rpc-auth-middleware.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.62
depth_status: DEEP
tags: [module, rpc, auth, middleware]
aliases: [rpc-auth-middleware]
---

# RPC Auth Middleware

## Purpose

Make native Effect RPC authorization visible at the contract and transport
policy layer. The middleware reads the required permission scope from
[[acp-rpc-contract]] annotations, resolves the bearer session through
[[rpc-auth]], and provides the authenticated actor through `AcpRpcActor`.
Handlers can consume that actor through [[rpc-auth]] `rpcActor`, which falls
back to header authorization for direct `accessHandler` tests.

## Interface

```typescript
export const AcpRpcRequiredScope: Context.Tag<Permission | undefined>
export class AcpRpcAuthMiddleware extends RpcMiddleware.Tag<...>
export const AcpRpcAuthMiddlewareLive: Layer<...>
```

## Algorithm

`AcpRpcRequiredScope` is an annotation tag attached to secured
[[acp-rpc-contract]] procedures. `AcpRpcAuthMiddleware` is an `@effect/rpc`
middleware tag that provides [[rpc-auth]] `AcpRpcActor` and fails with ACP
`ProtocolError`. Its live layer captures [[app-config]], [[session-service]], and
[[session-issuer]] once when the server layer is built; each request then reads the annotated scope
from `options.rpc.annotations` and delegates to [[rpc-auth]] with the request
headers.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT parse bearer tokens here. Token parsing and session policy stay in
  [[rpc-auth]] so handler-local and middleware auth cannot drift.
- ❌ Do NOT make direct handler tests depend on `RpcServer` middleware.
  `rpcActor` must keep the fallback path until each handler vertical has moved
  fully to mounted-client coverage.
- ❌ Do NOT invent per-RPC scope names. Use the closed [[common]] permission
  vocabulary.
- ❌ Do NOT capture a transport-local issuer; middleware and direct-handler
  fallback must share the application issuer instance.

## Depth

DEEP (0.62). Small module, but it establishes the policy seam that lets native
RPC move authorization out of every handler without changing the public contract.

## Referenced by

[[acp-rpc-contract]] · [[acp-rpc-server]] · [[rpc-auth]] · [[rpc/_MOC]]
