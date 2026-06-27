---
type: module
path: '@root/src/infrastructure/jsonrpc/json-rpc-runtime.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.72
depth_status: DEEP
tags: [module, seam, json-rpc]
aliases: [json-rpc-runtime, json-rpc-execute]
---

# JSON-RPC Execution Runtime

## Purpose

Execute the canonical commands produced by [[json-rpc]] against the running ACP
host and fold the outcomes back into JSON-RPC 2.0 responses. This is the
"runtime adapter" the core deferred: it owns request/response correlation,
notification suppression, batch handling, and HTTP-status → JSON-RPC-error
mapping — but stays **transport-agnostic**. The actual I/O (a stdio loop, a
WebSocket frame, or a `POST /rpc` route) is injected as a `JsonRpcDispatch`, so
one runtime serves every framing.

## Interface

### Signatures

```typescript
export interface JsonRpcDispatchResult {
  readonly status: number
  readonly body: unknown
}

// Executes one canonical command against the host. Injected by each transport:
// in tests/HTTP it wraps the acpRouter web handler; for stdio it would fetch the
// local server. `token` threads the connection's bearer session onto the request.
export type JsonRpcDispatch = (
  request: JsonRpcHttpRequest,
  token: Option.Option<string>,
) => Effect.Effect<JsonRpcDispatchResult>

// Single envelope or a batch array → the response(s) to send, or None when there
// is nothing to reply (all notifications, or an all-notification batch).
export const executeJsonRpc: (
  dispatch: JsonRpcDispatch,
  payload: unknown,
  token: Option.Option<string>,
) => Effect.Effect<Option.Option<JsonRpcResponse | readonly JsonRpcResponse[]>>
```

### Linkage

- **Requires:** [[json-rpc]] (`parseJsonRpcCommand`, `jsonRpcSuccess`,
  `jsonRpcError`, `JsonRpcRequestError`), `effect` `Option`/`Either`/`Effect`.
- **Consumed by:** future stdio / WebSocket / `POST /rpc` host adapters, which
  supply the `JsonRpcDispatch` and own the byte framing.

## Algorithm

For each envelope: `parseJsonRpcCommand`. A parse failure becomes `jsonRpcError`
(suppressed for notifications). A valid command is dispatched (its bearer `token`
forwarded) and the `{status, body}` result is folded:

- `2xx` → `jsonRpcSuccess(command, body)` (`204` carries a `null` result).
- `400` → JSON-RPC `-32602` Invalid params, the ACP error body as `data`.
- any other non-`2xx` → `-32603` Internal error, the ACP error body as `data`.

Notifications (no `id`) execute for their side effect but never produce a
response, even on error. A batch returns only the non-suppressed responses, or
`None` if none remain; an empty batch array is a single `-32600` Invalid Request.
Stream commands (`events.subscribe`, `request.stream === true`) are rejected with
`-32603` before dispatch — long-lived SSE cannot ride a request/response reply;
clients use the `GET /v1/events/stream` SSE route directly.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT re-route by path here — dispatch reuses [[acp-router]] so routing,
  auth ([[app-config]] `requireAuth`, spec §8 scopes), and encoding are not
  duplicated.
- ❌ Do NOT emit a response for a notification, even when dispatch fails.
- ❌ Do NOT attempt to stream an SSE body through a JSON-RPC reply.
- ❌ Do NOT invent error codes outside the JSON-RPC reserved set — domain failures
  collapse to `-32602`/`-32603` with the structured ACP error preserved in `data`.

## Depth

DEEP (0.72). Hides correlation, notification rules, batch folding, and error
translation behind one `executeJsonRpc`. Unit-tested with both a fake dispatch
(notification suppression, batch, error mapping, unknown method) and a real
in-process dispatch over the [[acp-router]] web handler (a JSON-RPC
`session.initialize` → scoped `work.create` round-trip).

## Grill Log

- **Q:** Execute by re-entering an HTTP web handler, or dispatch straight to the
  services?
  **A:** Re-enter via an injected `JsonRpcDispatch` that, in practice, calls the
  [[acp-router]] web handler. *Rationale:* the core already lowers each method to a
  `{method, path, body}` HTTP shape; reusing the router means JSON-RPC inherits
  routing, bearer auth, scope enforcement, encoding, and the total error→status
  map for free — exactly what [[json-rpc]] forbids duplicating. *Rejected:* a second
  method→service dispatch table (drifts from the router; re-implements auth).
- **Q:** stdio, WebSocket, or an HTTP `/rpc` route for this slice?
  **A:** None yet — ship the transport-agnostic execution core first, parameterized
  by `JsonRpcDispatch`. *Rationale:* correlation/notification/batch/error rules are
  identical across framings; isolating them keeps each future transport a thin I/O
  shell and makes the rules testable in-process without spawning a stdio child or a
  socket. *Rejected:* coupling execution to one framing now (forces a rewrite when
  the second transport lands).
- **Q:** How do JSON-RPC error codes map to ACP domain errors?
  **A:** `400 → -32602`, every other non-2xx `→ -32603`, with the structured ACP
  error body preserved in the JSON-RPC `error.data`. *Rationale:* the existing
  `JsonRpcErrorCode` is the closed JSON-RPC reserved set; collapsing into it while
  carrying the ACP error in `data` keeps fidelity without inventing codes.
  *Rejected:* application codes in `-32000..-32099` (would widen the schema for no
  client gain at v0.2).

## Referenced by

[[jsonrpc-index]] · [[json-rpc]] · [[acp-router]] · [[Transport]] · [[src/_MOC]]
