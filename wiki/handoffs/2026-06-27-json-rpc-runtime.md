---
date: 2026-06-27
topic: json-rpc-runtime-slice
from_role: Shadow
to_role: DNA Engineer
status: SLICE_COMPLETE
maturity: EXPLORING
tags: [handoff]
---

# Handoff — JSON-RPC Execution Runtime Slice (spec §13)

## Context

Picked up after a burst of direct-to-`main` commits (mandatory-auth, sqlite
adapter, storage selection, **json-rpc mapping core**) landed without handoffs.
The json-rpc _core_ ([[json-rpc]]) only normalized envelopes into canonical
commands and explicitly deferred execution to "a later slice". This is that slice.

## Done

- New [[json-rpc-runtime]] (`src/infrastructure/jsonrpc/json-rpc-runtime.ts`):
  `executeJsonRpc(dispatch, payload, token)` executes [[json-rpc]] commands via an
  injected, transport-agnostic `JsonRpcDispatch` and folds results into JSON-RPC
  2.0 responses. Owns correlation, notification suppression (no reply even on
  error), batch folding (`-32600` on empty batch), stream rejection
  (`events.subscribe` → `-32603`), and status→reserved-code mapping
  (`400`→`-32602`, else→`-32603`, ACP error preserved in `data`).
- Fixed a latent [[json-rpc]] bug: full-payload methods (`session.initialize`,
  `work.create`, `lease.request`, `artifact.create`, `checkpoint.create`,
  `review.request`) now forward the validated **wire** params (`validatedBody`)
  rather than the decoded Option-wrapped Type side, which `JSON.stringify` mangles
  into `{_id:Option,...}` and the HTTP API then rejects. Split methods
  (`work.claim`/`work.update`/`lease.release`) were already wire-safe (branded
  strings / literal `WorkState`).
- Barrel + wiki: [[jsonrpc-index]] re-exports the runtime; new [[json-rpc-runtime]]
  page (3 Grill entries); [[json-rpc]], jsonrpc `_MOC`/`index` refreshed; one core
  test updated to assert the wire body (`priority: 'high'`, not `Option.some`);
  CHANGELOG.
- Gate green: `tsc` · ESLint · Prettier (src) · **138 tests** (was 130; +8 runtime:
  6 folding-rule + 2 live-router; one core assertion corrected).

## Decided (do not re-litigate)

- **Execute by reusing [[acp-router]] through `JsonRpcDispatch`**, not a second
  method→service table — JSON-RPC inherits routing, bearer auth, §8 scopes,
  encoding, and the error→status map for free (what [[json-rpc]] forbids duplicating).
- **Ship the execution core transport-agnostic.** Correlation/notification/batch/
  error rules are identical across stdio/WS/HTTP; isolating them makes each future
  framing a thin I/O shell and keeps the rules testable in-process.
- **Body is wire form.** The command's `request.body` must be serializable onto the
  HTTP API; decode validates, the raw params are forwarded.
- **Error codes stay in the JSON-RPC reserved set** (`-32602`/`-32603`) with the ACP
  error in `data` — no `-32000..-32099` application codes at v0.2.

## Open / Remaining

1. **A concrete JSON-RPC framing** that supplies a real `JsonRpcDispatch` and owns
   byte I/O. Two candidates: a `POST /rpc` HTTP route (single + batch) mounted
   beside [[acp-router]] in [[http-app]], or a stdio loop (LSP/MCP-style) reading
   `Content-Length` frames. The HTTP route is the smaller, more testable next step
   and reuses the running server.
2. **Streaming over JSON-RPC** (`events.subscribe`) — currently rejected; a
   WS/stdio framing could deliver SSE-equivalent notifications later.

## Exact next action

DNA Engineer: pick the **`POST /rpc` HTTP framing** slice. Author a wiki page for a
route (or sibling router merged in [[http-app]]) that reads the JSON body, supplies
a `JsonRpcDispatch` backed by the in-process [[acp-router]] web handler, forwards
the connection's `Authorization: Bearer` token, calls `executeJsonRpc`, and returns
the response JSON (or `204` when the result is `None`). `grillme`: how the route
obtains the router web handler without a second `AppLive` (split-brain — see
[[sweeper#Grill Log]] / [[http-app]]); and batch `Content-Type`/response-shape rules.

## Links

[[json-rpc-runtime]] · [[json-rpc]] · [[acp-router]] · [[http-app]] · [[jsonrpc-index]]
· [[Transport]] · [[ADR-0001-architecture-foundation]]
