---
date: 2026-06-27
topic: json-rpc-http-slice
from_role: Shadow
to_role: DNA Engineer
status: SLICE_COMPLETE
maturity: EXPLORING
tags: [handoff]
---

# Handoff — JSON-RPC HTTP Endpoint Slice (`POST /rpc`, spec §13)

## Done

- New [[rpc-endpoint]] (`src/app/server/rpc-endpoint.ts`): `makeRpcHandler(routerApp)`
  is the `POST /rpc` handler. It reads the bearer token + JSON body (single/batch),
  runs `executeJsonRpc` with a `dispatchVia(routerApp)` that replays each command
  against the in-process router (`HttpServerRequest.fromWeb` → run app →
  `HttpServerResponse.toWeb`), and returns the JSON-RPC response (`204` for
  all-notification, `-32700` for non-JSON).
- [[acp-router]] split: `v1Router` (the `/v1` REST routes) + `acpRouter = v1Router`
  with `POST /rpc` mounted, dispatching into `v1Router` — acyclic, never recurses.
- [[json-rpc-runtime]] `executeJsonRpc`/`JsonRpcDispatch` made generic over `R`, so a
  dispatch can run inside a service context (the `/rpc` framing) or be `R = never`
  (fakes / web-handler).
- [[http-app]] / [[server-main]] unchanged — they already serve `acpRouter`, which now
  carries `/rpc`.
- Wiki: new [[rpc-endpoint]] page (3 Grill entries); [[acp-router]], [[json-rpc-runtime]],
  server `_MOC` refreshed; CHANGELOG.
- Gate green: `tsc` · ESLint · Prettier (src) · **144 tests** (was 138; +6 `/rpc`:
  round-trip, shared-store, notification 204, batch, unknown-method -32601, non-JSON
  -32700).

## Decided (do not re-litigate)

- **Replay the shared router via `dispatchVia`**, not `toWebHandlerLayer` — the latter
  builds a second `AppLive`/store; `/rpc` and `/v1` must share one store.
- **`acpRouter = v1Router + /rpc`; dispatch targets `v1Router`** — clean acyclic shape.
- **Parse failures stay in the JSON-RPC envelope** (`-32700` at HTTP `200`); only
  transport-level failures are non-2xx.
- **Streaming stays SSE.** `events.subscribe` is rejected by the runtime; clients use
  `GET /v1/events/stream`.

## Open / Remaining

1. **CLI `--rpc` mode (optional):** [[cli-client]] could POST `/rpc` instead of REST —
   low value (the REST client already works); skip unless asked.
2. **stdio JSON-RPC framing (optional):** a Node entrypoint reading `Content-Length`
   frames from stdin, supplying a `JsonRpcDispatch` that fetches the local server.
   Pure I/O shell over the same runtime; only if a non-HTTP host is wanted.
3. **Spec/docs:** README still describes only the REST surface — a `POST /rpc` example
   would round out the transport docs.

## Exact next action

DNA Engineer: the JSON-RPC transport is functionally complete for v0.2 over HTTP. Pick
the **README `POST /rpc` documentation** slice (small, doc-only): add a curl example
of a `session.initialize` then an authed `work.create` over `/rpc`, and note the
`-32700/-32601/-32602/-32603` mapping + the `204` notification behavior. `grillme`:
whether to also document batch semantics and the SSE-vs-`events.subscribe` split.
Defer stdio framing unless a non-HTTP host is explicitly requested.

## Links

[[rpc-endpoint]] · [[json-rpc-runtime]] · [[json-rpc]] · [[acp-router]] · [[http-app]]
· [[Transport]] · [[ADR-0001-architecture-foundation]]
