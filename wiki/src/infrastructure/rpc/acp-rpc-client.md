---
type: module
path: '@root/src/infrastructure/rpc/acp-rpc-client.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.55
depth_status: MEDIUM
tags: [module, medium, rpc, client]
aliases: [acp-rpc-client]
---

# ACP RPC Client

## Purpose

Expose the generated, fully-typed first-party client for the native
`@effect/rpc` surface — the consumer half of the
[[ADR-0007-effect-rpc-adoption]] transport stand-up. ACP's realistic clients are
Effect/TypeScript, so a generated `RpcClient` over [[acp-rpc-contract]] replaces
the hand-written request building the hand-mapped JSON-RPC layer would have
required.

## Interface

```typescript
export const makeAcpRpcClient: Effect<
  RpcClient<AcpRpcGroup, RpcClientError>,
  never,
  RpcClient.Protocol | Scope
>

export const acpRpcClientHttpLayer: (url: string) => Layer<RpcClient.Protocol>
export const acpRpcClientHostLayer: (
  baseUrl: string,
) => Layer<RpcClient.Protocol>
export const acpNativeRpcPath = '/rpc/native'
export const acpNativeRpcUrl: (baseUrl: string) => string
export const acpRpcBearerHeaders: (sessionId: SessionId) => {
  readonly authorization: string
}
export const withAcpRpcBearer: (
  sessionId: SessionId,
) => <A, E, R>(effect: Effect<A, E, R>) => Effect<A, E, R>
```

## Algorithm

`makeAcpRpcClient` is `RpcClient.make(AcpRpcGroup)`. Because every contract tag
is dotted (`session.initialize`, `workspace.create`, …), the client is
prefix-grouped: `client.session.initialize(payload, { headers })`,
`client.workspace.list(undefined, { headers })`, and so on. Each method returns
an Effect whose error channel is the contract's typed `ProtocolError`; bearer
auth is forwarded per call via the `headers` option (or
`RpcClient.withHeaders` for a scoped default), which the server reads through
`options.headers`.

`acpNativeRpcPath` is the single source for the mounted native route path shared
by [[native-rpc-route]] and first-party clients. `acpNativeRpcUrl(baseUrl)`
normalizes trailing slashes before appending that path. `acpRpcBearerHeaders`
builds the low-level header object, while `withAcpRpcBearer(sessionId)` wraps an
Effect with `RpcClient.withHeaders` so a caller can scope a block of generated
client calls without repeating `{ authorization: ... }` on every operation.

`acpRpcClientHttpLayer(url)` wires the NDJSON-framed streaming-HTTP protocol:
`RpcClient.layerProtocolHttp({ url })` provided with
`RpcSerialization.layerNdjson` and `FetchHttpClient.layer`, so callers can supply
a fully mounted native RPC URL when they need custom routing.
`acpRpcClientHostLayer(baseUrl)` is the common host-facing path: it derives the
mounted URL with `acpNativeRpcUrl(baseUrl)` and then builds the HTTP protocol
layer. NDJSON framing is required for streaming operations such as
`events.subscribe`; unary calls use the same client layer.
The round-trip test set proves the client/handler contract through `RpcTest`
without a socket: [[acp-rpc-roundtrip-test]] covers the initial workspace path,
[[acp-rpc-roundtrip-work-lease-test]] covers worker/workspace/work/lease,
[[acp-rpc-roundtrip-artifact-checkpoint-test]] covers artifact and checkpoint,
and [[acp-rpc-roundtrip-review-memory-event-test]] covers review, memory, and
event listing. [[native-rpc-route]] covers the mounted over-the-wire path.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT hand-build JSON-RPC envelopes — the generated client owns
  encoding, request ids, and response decoding.
- ❌ Do NOT duplicate `/rpc/native` path literals in callers. Use
  `acpNativeRpcPath` or `acpNativeRpcUrl`.
- ❌ Do NOT bypass the typed `ProtocolError` channel with untyped catches.

## Depth

MEDIUM (0.55). Thin factory surface, but it is the contracted client boundary
first-party consumers integrate against.

## Referenced by

[[acp-rpc-server]] · [[acp-rpc-contract]] ·
[[acp-rpc-roundtrip-artifact-checkpoint-test]] ·
[[acp-rpc-roundtrip-review-memory-event-test]] ·
[[acp-rpc-roundtrip-work-lease-test]] · [[rpc-index]] · [[rpc/_MOC]]
