---
type: module
path: '@root/src/app/server/rpc-endpoint.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, server, json-rpc, http]
aliases: [rpc-endpoint.test]
---

# JSON-RPC HTTP Endpoint Tests

## Purpose

Prove [[rpc-endpoint]] preserves JSON-RPC 2.0 framing while sharing ACP session,
storage, authorization, lifecycle, and event behavior with REST.

## Interface

Vitest suite posting JSON-RPC payloads to the in-process [[acp-router]] web
handler, with optional bearer authorization.

## Algorithm

Initialize a session and create scoped work through JSON-RPC, then use an
RPC-minted token on a direct REST mutation to prove one store/auth graph. Publish
work progress, drive review approval, and delete an artifact through RPC. Require
notification-only input to return HTTP 204 with no body; require a mixed batch to
return only id-bearing responses. Pin unknown method to `-32601` at HTTP 200 and
malformed JSON to `-32700` at HTTP 200.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT compose a second application store behind `/rpc`.
- ❌ Do NOT return a response body for notifications.
- ❌ Do NOT include notification entries in batch output.
- ❌ Do NOT translate JSON-RPC method/parse failures into HTTP 4xx statuses.
- ❌ Do NOT bypass bearer scopes when dispatching into REST handlers.

## Grill Log

- **Q:** What is the strongest shared-store evidence? **A:** A session minted by
  `/rpc` authorizes a subsequent `/v1` mutation on the same handler. _Rejected:_
  merely comparing independent response shapes.

## Referenced by

[[rpc-endpoint]] · [[acp-router]] · [[json-rpc-runtime]] · [[server/_MOC]] ·
[[Transport]] · [[src/_MOC]]
