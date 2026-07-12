---
type: module
path: '@root/src/app/server/rpc-socket.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.72
depth_status: DEEP
tags: [module, seam, json-rpc, websocket]
aliases: [rpc-socket, json-rpc-websocket]
---

# JSON-RPC WebSocket Endpoint

## Purpose

The `GET /rpc` framing (spec §7: _JSON-RPC 2.0 over WebSocket_): the second
concrete transport over the [[json-rpc-runtime]], beside [[rpc-endpoint]]'s
`POST /rpc`. It upgrades the connection to a WebSocket, then for every inbound
text frame executes a JSON-RPC 2.0 payload (single or batch) against the
**in-process [[acp-router]]** via the shared-context `dispatchVia` it imports from
[[rpc-endpoint]] — the exact dispatch the HTTP framing uses, so WebSocket, HTTP,
and REST share one `Storage` (no second `AppLive`). The connection's bearer token
authorizes every frame for the life of the socket. A single `events.subscribe`
request is the WebSocket live-event extension: it acknowledges the subscription
and sends each later workspace [[Event]] as a JSON-RPC notification on the same
socket.

## Interface

### Signatures

```typescript
export const makeRpcSocketHandler: <E, R>(
  routerApp: HttpApp.Default<E, R>,
) => Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  Error,
  | Exclude<R, HttpServerRequest.HttpServerRequest>
  | EventStore
  | HttpServerRequest.HttpServerRequest
  | Scope.Scope
>
```

### Linkage

- **Requires:** [[json-rpc-runtime]] (`executeJsonRpc`), [[event-store]],
  [[rpc-endpoint]] (`dispatchVia`, `parseErrorEnvelope`), `@effect/platform`
  `HttpServerRequest.upgrade`/`Socket` (`runRaw` + `writer`).
- **Consumed by:** [[acp-router]] — mounts `makeRpcSocketHandler(v1Router)` at
  `GET /rpc` beside `POST /rpc`.

## Algorithm

1. Resolve the connection bearer token: the handshake `Authorization: Bearer`
   header, or a `?token=` query parameter when no header is present (a browser
   cannot set headers on the WebSocket handshake). Header wins.
2. `HttpServerRequest.upgrade` → a `Socket`. Acquire its `writer` in a `Scope`.
3. Build a serialized JSON writer so normal command responses and event
   notifications cannot interleave on the socket.
4. `socket.runRaw` per inbound frame: decode to text; a non-JSON frame writes back
   the `-32700` `parseErrorEnvelope`. A single `events.subscribe` frame decodes
   `workspace_id`, acknowledges with a normal JSON-RPC result when the request has
   an `id`, then forks a scoped [[event-store]] subscription that writes
   `events.event` notifications with schema-encoded [[Event]] payloads. Other
   payloads use `executeJsonRpc(dispatchVia(routerApp), payload, token)` and write
   the `Some(response)` back as one text frame (`None` — all notifications —
   writes nothing).
5. The handler effect blocks in `runRaw` for the socket's lifetime and returns an
   empty response once the connection closes.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT re-derive the dispatch — import `dispatchVia` from [[rpc-endpoint]] so
  both transports replay against the same `v1Router` (one store, one auth path).
- ❌ Do NOT add a `ws` dependency or hand-roll the WebSocket handshake — the
  platform `HttpServerRequest.upgrade` owns the protocol.
- ❌ Do NOT re-authenticate per frame — the token is fixed at handshake; a client
  that needs a different identity opens a new connection.
- ❌ Do NOT translate domain errors here — [[json-rpc-runtime]] owns status→code
  mapping; this module only frames bytes.
- ❌ Do NOT stream from `POST /rpc`; only the upgraded WebSocket can hold a live
  subscription. HTTP JSON-RPC keeps rejecting stream commands in
  [[json-rpc-runtime]].
- ❌ Do NOT invent host-presence notifications here; this stream carries persisted
  workspace [[Event]]s only.

## Depth

DEEP (0.72). Bridges WebSocket text frames ↔ JSON-RPC while reusing the entire
router (routing, bearer auth, §8 scopes, encoding, error mapping) through the
shared `dispatchVia`, while hiding the event-subscription lifetime and
notification framing. Tested over a real ephemeral socket: a `session.initialize`
round-trip, a second connection whose `?token=` query authorizes a scoped
`work.create`, a REST `GET` proving WebSocket and REST share one store, a
non-JSON frame echoing `-32700`, and `events.subscribe` receiving a later
workspace event as an `events.event` notification.

## Grill Log

- **Q:** In-server upgrade (`GET /rpc`) or a sidecar bridge like the stdio one
  ([[stdio-main]])?
  **A:** In-server: the host speaks WebSocket directly on the same socket as HTTP,
  reusing `dispatchVia` with zero new process and zero new store. _Rationale:_ the
  stdio bridge is a sidecar only because stdin/stdout are not HTTP; a WebSocket
  rides the existing HTTP server, so the upgrade belongs on the router. _Rejected:_
  a `acp-jsonrpc-ws` sidecar that runs a WS server and forwards to `POST /rpc`
  (adds a `ws` dependency and a hop for no isolation gain).
- **Q:** How does a browser authenticate when it cannot set the handshake
  `Authorization` header?
  **A:** A `?token=` query parameter on the upgrade URL is the documented fallback;
  the header still wins when present (non-browser clients). _Rationale:_ keeps the
  reference host usable from both a Node client and a browser without a
  cookie/session dance. _Rejected:_ a first-frame `session.authenticate` message
  (stateful per-connection handshake the runtime would have to special-case).
- **Q:** Why does the token bind to the connection, not the frame?
  **A:** `dispatchVia` forwards one bearer per command; a WebSocket multiplexes
  many commands over one authenticated connection, matching how `/rpc` over HTTP
  carries one `Authorization` per request. _Rationale:_ a connection is the natural
  identity boundary. _Rejected:_ per-frame tokens (re-opens the auth path on every
  message for no real multi-tenant need).
- **Q:** Should `events.subscribe` reuse SSE frames or JSON-RPC notifications?
  **A:** JSON-RPC notifications named `events.event`, with the encoded ACP
  [[Event]] in `params`. _Rationale:_ the client already speaks JSON-RPC on this
  socket, notifications preserve the protocol envelope, and SSE remains the HTTP
  live channel. _Rejected:_ tunneling raw `event:`/`data:` SSE frames over the
  socket (mixes two wire protocols), and a second request/response result per
  event (breaks JSON-RPC correlation).
- **Q:** What is unsubscribe?
  **A:** Socket close. _Rationale:_ spec §13 has `events.subscribe` but no
  `events.unsubscribe`; the reference host should avoid a private lifecycle method
  until the protocol names one. _Rejected:_ custom `events.unsubscribe`
  (non-spec method) and replacing subscriptions on repeated calls (surprising for
  clients that intentionally watch multiple workspaces).

## Referenced by

[[rpc-socket.test]] · [[acp-router]] · [[rpc-endpoint]] ·
[[json-rpc-runtime]] · [[event-store]] · [[http-app]] · [[Transport]] ·
[[src/_MOC]]
