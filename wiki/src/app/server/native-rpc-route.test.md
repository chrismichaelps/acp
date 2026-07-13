---
type: module
path: '@root/src/app/server/native-rpc-route.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, server, rpc, native, socket]
aliases: [native-rpc-route.test]
---

# Native RPC Route Tests

## Purpose

Prove [[native-rpc-route]] serves the generated typed client over a real host
socket with shared REST state, bearer scopes, unary method parity, and event
streaming.

## Interface

Vitest integration suite booting `HttpAppLive` on an OS-assigned port and
providing `acpRpcClientHostLayer` to the generated native RPC client.

## Algorithm

Create a workspace through typed RPC, deny the same write under a read-only
session, and list it through REST to prove shared state. Subscribe to workspace
events and match a published progress event. Round-trip worker, workspace,
work, and complete lease lifecycle/readback; artifact update/content/list and
checkpoint latest; and review approval, memory create/list, event publication,
and unary event list through the mounted HTTP transport.
Initialize typed sessions carrying `review:collaborate` and `review:respond`,
require each returned session to preserve its literal, and use their bearer
identities against the matching REST-owned collaboration/answer surface. Native
RPC does not add comment/grill methods in this slice; its obligation is shared
permission codec/session propagation. Attempt a typed initialization carrying
both literals and require the exact mutual-exclusion failure with no minted
session.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT test only in-process `RpcTest`; this suite owns mounted HTTP framing.
- ❌ Do NOT allocate a second app graph for native handlers.
- ❌ Do NOT bypass bearer scope denial through typed client convenience helpers.
- ❌ Do NOT claim parity from workspace CRUD alone; every split vertical must
  cross the live route.
- ❌ Do NOT replace streaming with polling or unary list assertions.
- ❌ Do NOT add dead native RPC collaboration handlers merely to claim transport
  parity.
- ❌ Do NOT accept both review role scopes in one typed session.

## Grill Log

- **Q:** Why read a native-RPC write through REST? **A:** Cross-transport
  visibility is the strongest evidence that one host graph backs every surface.
  _Rejected:_ independent native responses that could come from split state.

## Referenced by

[[native-rpc-route]] · [[acp-rpc-client]] · [[acp-rpc-server]] · [[http-app]] ·
[[server/_MOC]] · [[Transport]] · [[src/_MOC]]
