---
type: module
path: '@root/src/app/server/rpc-endpoint.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.74
depth_status: DEEP
tags: [module, seam, json-rpc]
aliases: [rpc-endpoint, json-rpc-http]
---

# JSON-RPC HTTP Endpoint

## Purpose

The `POST /rpc` framing (spec §13): the first concrete transport over the
[[json-rpc-runtime]]. It reads a JSON-RPC 2.0 payload (single or batch), supplies a
`JsonRpcDispatch` backed by the **in-process [[acp-router]]**, executes via
`executeJsonRpc`, and returns the response JSON. Because dispatch replays commands
against the same router app in the same service context, `/rpc` and the `/v1` REST
surface share one `Storage` — no second `AppLive`.

## Interface

### Signatures

```typescript
export const makeRpcHandler: <E, R>(
  routerApp: HttpApp.Default<E, R>,
) => Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  never,
  | Exclude<R, HttpServerRequest.HttpServerRequest>
  | HttpServerRequest.HttpServerRequest
>
```

### Linkage

- **Requires:** [[json-rpc-runtime]] (`executeJsonRpc`, `JsonRpcDispatch`),
  `@effect/platform` `HttpServerRequest`/`HttpServerResponse`/`Headers`.
- **Consumed by:** [[acp-router]] — mounts `makeRpcHandler(v1Router)` at `POST /rpc`
  beside the `/v1` routes.

## Algorithm

1. Read the connection bearer token from the incoming `Authorization` header.
2. Decode the body as JSON (`Schema.Unknown`, single or batch); a non-JSON body
   short-circuits to a JSON-RPC `-32700` parse error at HTTP `200`.
3. `executeJsonRpc(dispatchVia(routerApp), payload, token)`. `dispatchVia` builds a
   synthetic web `Request` per command (`HttpServerRequest.fromWeb`), forwards the
   bearer token, runs `routerApp` with it provided, and reads the result back via
   `HttpServerResponse.toWeb` → `{status, body}`. `RouteNotFound` is mapped to a
   `404` result (unreachable — commands only carry valid `/v1` paths).
4. `None` (all notifications) → HTTP `204` with no body; `Some(response)` → HTTP
   `200` with the JSON-RPC response (object or batch array).

## Negative Logic (Prohibited Paths)

- ❌ Do NOT build the dispatch from `HttpApp.toWebHandlerLayer` — that spins a second
  `AppLive` (a separate store); replay against the shared `routerApp` instead.
- ❌ Do NOT mount `/rpc` onto the router it dispatches into — it dispatches into
  `v1Router` (the `/v1` routes only), never into itself.
- ❌ Do NOT translate domain errors here — [[json-rpc-runtime]] owns status→code
  mapping; this module only frames bytes.
- ❌ Do NOT stream here — stream commands are rejected upstream by the runtime.

## Depth

DEEP (0.74). Bridges HTTP bytes ↔ JSON-RPC while reusing the entire router
(routing, bearer auth, §8 scopes, encoding, error mapping). Tested over the
`acpRouter` web handler: single round-trip, a `/rpc`-minted session authorizing a
direct `/v1` call (shared store), `work.publish_event` progress publication,
notification `204`, batch folding, unknown-method `-32601`, and non-JSON
`-32700`.

## Grill Log

- **Q:** How does `/rpc` reach the router without a second `AppLive` (the
  split-brain risk from [[sweeper#Grill Log]] / [[http-app]])?
  **A:** `dispatchVia` replays each command against the **same** `v1Router` app
  value in the ambient service context — it provides only a synthetic
  `HttpServerRequest`, leaving the services (`R`) to the ambient layer that already
  serves the router. _Rationale:_ one store, one auth path, zero duplication.
  _Rejected:_ `HttpApp.toWebHandlerLayer(acpRouter, AppLive)` inside the handler
  (builds an independent store — `/rpc` would never see `/v1`'s sessions).
- **Q:** Why split `v1Router` out from `acpRouter`?
  **A:** `/rpc` dispatches into the `/v1` routes; if it were a route _on_ the same
  router it dispatched into, the value would reference itself. `acpRouter =
v1Router + POST /rpc`, and dispatch targets `v1Router`. _Rationale:_ a clean
  acyclic shape — JSON-RPC can never recurse into `/rpc`. _Rejected:_ a lazy
  self-reference inside `acpRouter` (works via deferred evaluation but is a footgun).
- **Q:** Where do JSON-RPC parse failures sit — HTTP status or JSON-RPC error?
  **A:** A non-JSON body returns HTTP `200` with a JSON-RPC `-32700` (spec §13 keeps
  protocol errors in the envelope); only transport-level failures would be non-2xx.
  _Rejected:_ HTTP `400` for a malformed envelope (leaks JSON-RPC semantics into the
  HTTP status).

## Referenced by

[[acp-router]] · [[json-rpc-runtime]] · [[http-app]] · [[Transport]] · [[src/_MOC]]
