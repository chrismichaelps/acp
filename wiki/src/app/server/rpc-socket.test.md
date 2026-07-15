---
type: module
path: '@root/src/app/server/rpc-socket.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, server, json-rpc, websocket]
aliases: [rpc-socket.test]
---

# JSON-RPC WebSocket Tests

## Purpose

Prove [[rpc-socket]] handles real HTTP upgrade, connection-bound bearer auth,
shared REST storage, parse errors, and workspace event notifications.

## Interface

Vitest integration suite booting `HttpAppLive` on an OS-assigned TCP port via
`nodeHttpServerLayer(0)` and dialing with the platform WebSocket client.

## Algorithm

Initialize a trusted-client session on one socket, then open a second socket
carrying its minted token in the query and create work. In static mode, require
the issuance credential in the handshake header and reject the same credential
in `?token=`. Fetch created work through REST to prove socket and
HTTP share one store. Send a non-JSON frame and require a `-32700` JSON-RPC error.
Subscribe to workspace events, create work on the same connection, and require an
`events.event` notification containing `work.created` for that workspace. Reject
subscription before acknowledgement for a missing token, missing `event:read`,
foreign workspace binding, and revoked static provenance; allow a properly
scoped/bound session.
Round-trip `review:collaborate` and `review:respond` through WebSocket
`session.initialize`, then bind each returned token to a connection or REST
request and require the preserved permission to authorize only its matching REST
surface. Reject a WebSocket initialization carrying both scopes with the exact
mutual-exclusion issue and no session id. No WebSocket comment/grill command is
introduced.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT use an in-memory socket fake; the upgrade path must bind real TCP.
- ❌ Do NOT lose the handshake token between frames on one connection.
- ❌ Do NOT create a private store for WebSocket dispatch.
- ❌ Do NOT close silently on malformed JSON; return the protocol parse error.
- ❌ Do NOT encode subscribed events as correlated responses rather than
  notifications.
- ❌ Do NOT claim WebSocket collaboration commands that are absent from the
  JSON-RPC command map; test session propagation only.
- ❌ Do NOT accept both review role scopes in one WebSocket session.
- ❌ Do NOT use an issuance credential in a query string.
- ❌ Do NOT treat subscription as public EventStore access.

## Grill Log

- **Q:** Why authenticate the second connection via query? **A:** It proves the
  browser-compatible handshake path documented by [[rpc-socket]] while REST
  readback proves the identity acted on shared state. _Rejected:_ header-only
  coverage that misses browser constraints.

## Referenced by

[[rpc-socket]] · [[rpc-endpoint]] · [[acp-router]] · [[server/_MOC]] ·
[[Transport]] · [[src/_MOC]]
