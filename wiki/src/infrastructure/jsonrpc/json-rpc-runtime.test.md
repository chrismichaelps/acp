---
type: module
path: '@root/src/infrastructure/jsonrpc/json-rpc-runtime.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, infrastructure, json-rpc, runtime]
aliases: [json-rpc-runtime.test]
---

# JSON-RPC Runtime Tests

## Purpose

Prove [[json-rpc-runtime]] correlation, notification suppression, HTTP error
folding, stream rejection, batch semantics, live router execution, and scope
enforcement.

## Interface

Vitest suite over injected stub dispatches and a real [[acp-router]] web handler
backed by `AppLive`.

## Algorithm

Correlate ids on success while executing notifications without replying. Fold
400 to `-32602`, other non-2xx to `-32603`, and preserve the ACP error body in
`data`. Reject unknown methods and request/response use of `events.subscribe`;
never dispatch the latter. Filter notification results from batches and reject
an empty batch with `-32600`. Against the live router, initialize a scoped
session, create work as its actor, and surface insufficient scope as `-32603`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT reply to notifications, including failed notifications.
- ❌ Do NOT dispatch a streaming command through request/response execution.
- ❌ Do NOT lose ACP error data during JSON-RPC folding.
- ❌ Do NOT bypass bearer scope enforcement in live dispatch.

## Grill Log

- **Q:** Why test both stub and live dispatch? **A:** Stubs isolate folding
  invariants; the live router proves those invariants compose with real auth,
  actor identity, schemas, and domain services. _Rejected:_ treating either
  layer alone as end-to-end proof.

## Referenced by

[[json-rpc-runtime]] · [[acp-router]] · [[jsonrpc/_MOC]] · [[Transport]] ·
[[src/_MOC]]
