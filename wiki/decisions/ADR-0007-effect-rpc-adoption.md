---
type: adr
status: ACCEPTED
date: 2026-06-29
tags: [adr, transport, json-rpc, effect-rpc]
aliases: [ADR-0007, ADR-0007-effect-rpc-adoption]
---

# ADR-0007 — Adopt @effect/rpc, Retire the Hand-Mapped JSON-RPC Layer

## Status

ACCEPTED — 2026-06-29. Supersedes the framing decision in
[[ADR-0002-json-rpc-transport-framing]] (request/response transport) and the
generated-client deferral in [[ADR-0004-protocol-version-codecs-generated-client]].
Implementation is staged and NOT yet started; this ADR records the direction.

## Context

`src/infrastructure/jsonrpc/` implements JSON-RPC 2.0 as an **HTTP-bridging
translation layer**, not a native RPC surface. [[json-rpc-command-map]] maps each
method to a synthetic `JsonRpcHttpRequest` (verb + REST path + body); the
`POST /rpc` ([[rpc-endpoint]]) and `GET /rpc` ([[rpc-socket]]) framings replay
that request through the in-process HTTP router via `dispatchVia`, then
[[json-rpc-runtime]] folds the HTTP status back into JSON-RPC codes. A review on
2026-06-29 found:

- **Double decode + extra round-trip** — params decode once in the command map,
  then the body decodes again in the route; `dispatchVia` `JSON.stringify`s the
  body and re-`json()`s the response.
- **`validatedBody` launders types** — it decodes purely to validate, discards
  the decoded value, and forwards the raw `unknown` wire blob (a scar of the
  second HTTP round-trip).
- **Error modeling is lossy** — every non-2xx collapses to `-32602`/`-32603`; a
  `401`/`403`/`404`/`409` all report as `Internal error`.
- **Two routing tables by hand** — every REST path is re-typed as a string in the
  command modules; adding one method is a four-place edit dispatched by linear
  scan across five files.
- **Streaming is dead** — `events.subscribe` is advertised but always rejected.
- **No client** — the server has no first-party consumer; the CLI uses REST.

The decisive constraint: ACP's realistic clients are **first-party Effect/TS
only** (Claude Code adapter, Codex adapter, Tauri client), with no polyglot or MCP
consumer. JSON-RPC 2.0 wire compatibility — the sole value the custom layer buys —
is therefore a paper requirement inherited from the draft `specs.md`.

## Decision

ACP adopts **`@effect/rpc`** as the native RPC transport and retires the
hand-mapped JSON-RPC command layer. A single `RpcGroup` declares the protocol
operations over the **domain schemas** (not HTTP paths); handlers built with
`Group.toLayer(...)` call the domain services directly; a generated `RpcClient`
serves the CLI and adapters. `@effect/rpc`'s wire protocol is bespoke (Request /
Ack / Eof / Chunk / Exit, branded `bigint` RequestId), so this **replaces** the
JSON-RPC 2.0 wire rather than interoperating with it — acceptable because no
JSON-RPC/MCP client exists.

The following become unnecessary and are deleted once the RpcGroup is live:
[[json-rpc-command-map]], the four `*-commands.ts` modules, [[json-rpc-runtime]]
folding, the [[json-rpc]] envelope parser, `validatedBody`, `dispatchVia`,
[[rpc-endpoint]], and [[rpc-socket]] (replaced by `@effect/rpc` protocol layers).
The §8 scope→actor authorization moves into an `RpcMiddleware`; domain error
mapping is expressed once as Schema `error` channels.

## Rationale

With interop removed from the equation, `@effect/rpc` wins on every axis that
remains: end-to-end type safety (payload/success/error inferred client↔server),
typed errors carried verbatim, single decode, first-class streaming with
`Chunk`/`Ack` backpressure (finally making `events.subscribe` real), `msgpack`
option, a generated typed client, and `RpcTest.makeClient` for transport-less
handler tests. It also finally honors the [[Transport]] seam invariant — domain
services stop being reached through HTTP semantics — and deletes ~1000 lines of
accidental complexity.

## Consequences

Spec §7 JSON-RPC 2.0 conformance is intentionally dropped; ACP's reference host
speaks Effect-RPC, recorded here as a deliberate narrowing of the draft (as
[[ADR-0005-worker-presence-scope]] narrowed presence). `@effect/rpc` is pre-1.0
(`0.75.x`) and its protocol/serialization layers may churn — the `RpcGroup`
contract is the stable surface; transport/serialization layers are swappable. The
migration is staged: (1) this ADR; (2) the `RpcGroup` contract + handlers as new
files over the domain services; (3) auth middleware; (4) generated client for the
CLI; (5) port tests to `RpcTest`; (6) delete the JSON-RPC layer last. Each stage
touches the central transport files, so it must be sequenced against parallel work
on `router.ts`/`acp-http-api.ts`.

## Alternatives

Keep JSON-RPC 2.0 and rewrite only its internals to dispatch to a transport-
agnostic domain command bus — rejected: it preserves a paper wire format and its
maintenance cost for zero interop benefit given first-party-only clients.

Add `@effect/rpc` as an additional internal transport beside JSON-RPC 2.0 —
rejected: two transports to maintain with no consumer for the JSON-RPC one.

Make `@effect/rpc` speak JSON-RPC 2.0 via custom `RpcSerialization` — rejected:
serialization controls byte encoding, not the Request/Ack/Eof/RequestId framing;
JSON-RPC's id/notification/batch semantics do not map onto `RpcMessage`.

## Validation

Direction only; no code yet. The review evidence is the current
`src/infrastructure/jsonrpc/` source and the confirmed `@effect/rpc` wire protocol
(`packages/rpc/src/RpcMessage.ts`) and test client (`RpcTest.ts`).

## Referenced by

[[ADR-0002-json-rpc-transport-framing]] ·
[[ADR-0004-protocol-version-codecs-generated-client]] · [[Transport]] ·
[[json-rpc-command-map]] · [[decisions/_MOC]]
