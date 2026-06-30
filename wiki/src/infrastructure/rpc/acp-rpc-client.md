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

export const acpRpcClientHttpLayer: (
  url: string,
) => Layer<RpcClient.Protocol>
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

`acpRpcClientHttpLayer(url)` wires the JSON-framed streaming-HTTP protocol:
`RpcClient.layerProtocolHttp({ url })` provided with `RpcSerialization.layerJson`
and `FetchHttpClient.layer`, so callers supply only the host's native RPC URL.
The [[acp-rpc-roundtrip-test]] proves the client/handler contract through
`RpcTest` without a socket; pointing this layer at a mounted route is the
remaining transport step.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT hand-build JSON-RPC envelopes — the generated client owns
  encoding, request ids, and response decoding.
- ❌ Do NOT bypass the typed `ProtocolError` channel with untyped catches.

## Depth

MEDIUM (0.55). Thin factory surface, but it is the contracted client boundary
first-party consumers integrate against.

## Referenced by

[[acp-rpc-server]] · [[acp-rpc-contract]] · [[rpc-index]] · [[rpc/_MOC]]
