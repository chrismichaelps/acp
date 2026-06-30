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
[[rpc-auth]], and provides the authenticated actor for future handler cleanup.
The existing handler-local `authorizeRpc` calls remain in place for direct
`accessHandler` tests and as defense-in-depth while the native route matures.

## Interface

```typescript
export const AcpRpcActor: Context.Tag<WorkerId>
export const AcpRpcRequiredScope: Context.Tag<Permission | undefined>
export class AcpRpcAuthMiddleware extends RpcMiddleware.Tag<...>
export const AcpRpcAuthMiddlewareLive: Layer<...>
```

## Algorithm

`AcpRpcRequiredScope` is an annotation tag attached to secured
[[acp-rpc-contract]] procedures. `AcpRpcAuthMiddleware` is an `@effect/rpc`
middleware tag that provides `AcpRpcActor` and fails with ACP `ProtocolError`.
Its live layer captures [[app-config]] and [[session-service]] once when the
server layer is built; each request then reads the annotated scope from
`options.rpc.annotations` and delegates to [[rpc-auth]] with the request headers.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT parse bearer tokens here. Token parsing and session policy stay in
  [[rpc-auth]] so handler-local and middleware auth cannot drift.
- ❌ Do NOT remove handler-local auth checks in the same slice. Direct handler
  tests do not execute `RpcServer` middleware, so that migration needs its own
  test strategy.
- ❌ Do NOT invent per-RPC scope names. Use the closed [[common]] permission
  vocabulary.

## Depth

DEEP (0.62). Small module, but it establishes the policy seam that lets native
RPC move authorization out of every handler without changing the public contract.

## Referenced by

[[acp-rpc-contract]] · [[acp-rpc-server]] · [[rpc-auth]] · [[rpc/_MOC]]
