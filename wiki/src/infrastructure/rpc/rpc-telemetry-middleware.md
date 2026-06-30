---
type: module
path: '@root/src/infrastructure/rpc/rpc-telemetry-middleware.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Observability]]'
depth_score: 0.62
depth_status: DEEP
tags: [module, rpc, observability, middleware]
aliases: [rpc-telemetry-middleware]
---

# RPC Telemetry Middleware

## Purpose

Give the native `@effect/rpc` surface the same structured completion visibility
that REST and legacy JSON-RPC routes already receive through [[route-support]].
The middleware is intentionally narrow: it logs operation identity, client id,
outcome, duration, and stable ACP error code when the failure is a
`ProtocolError`. It never logs payloads, bearer headers, or local file content.

## Interface

```typescript
export class AcpRpcTelemetryMiddleware extends RpcMiddleware.Tag<...>
export const AcpRpcTelemetryMiddlewareLive: Layer<...>
```

## Algorithm

`AcpRpcTelemetryMiddleware` is a wrap-style `@effect/rpc` middleware. For each
request it records `Clock.currentTimeMillis`, runs `options.next` inside an
Effect log span named `acp.rpc.<operation>`, and uses `Effect.onExit` to emit
one completion log after success, protocol failure, or defect. Success logs use
`Effect.logInfo`; failures use `Effect.logWarning`. The emitted annotations are
low-cardinality fields designed for indexing: `rpc_operation`, `rpc_client_id`,
`rpc_outcome`, `duration_ms`, `rpc_failure`, and `error_code` when available.

The contract attaches telemetry after [[rpc-auth-middleware]] for scoped calls.
That order matters because auth is implemented as service-providing middleware:
the telemetry wrapper must surround the auth-provided handler so authorization
failures are logged as failed RPC calls rather than disappearing before the
handler span exists.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT log RPC payloads or headers. Payloads may contain patches, memory,
  review details, or bearer credentials.
- ❌ Do NOT introduce a custom logging service here. ACP uses Effect logging
  primitives so server-level JSON formatting and minimum log level remain
  centralized in [[app-logging]].
- ❌ Do NOT make telemetry optional per handler. Native RPC operations should
  have one consistent completion signal.

## Depth

DEEP (0.62). The module is small, but it closes a production observability gap
at the transport boundary without changing domain services or handler behavior.

## Referenced by

[[acp-rpc-contract]] · [[acp-rpc-server]] · [[rpc/_MOC]]
