---
type: adr
status: ACCEPTED
date: 2026-06-27
tags: [adr, transport, json-rpc]
aliases: [ADR-0002, ADR-0002-json-rpc-transport-framing]
---

# ADR-0002 — JSON-RPC Transport Framing

## Status

ACCEPTED — 2026-06-27. SUPERSEDED for WebSocket transport — 2026-06-29 (see
Updates). SUPERSEDED by [[ADR-0007-effect-rpc-adoption]] — 2026-06-29: the entire
hand-mapped JSON-RPC framing is slated for removal in favor of `@effect/rpc`
(first-party Effect/TS clients; JSON-RPC 2.0 wire dropped). This ADR's framing
remains in effect only until that migration lands.

## Update — 2026-06-29 (request/response)

The WebSocket _request/response_ deferral is lifted: [[rpc-socket]] mounts a
`GET /rpc` upgrade beside `POST /rpc`, reusing the in-process router through the
same `dispatchVia` ([[rpc-endpoint]]). The design-note concerns this ADR raised
are resolved for request/response: **auth** is a connection-bound bearer (handshake
`Authorization` header or `?token=` query, since browsers cannot set handshake
headers); **server upgrade** is `HttpServerRequest.upgrade` (no `ws` dependency, no
hand-rolled handshake); **heartbeat/backpressure** are owned by the platform
socket. What remained deferred in this update was JSON-RPC event _subscription_
(`events.subscribe`).

## Update — 2026-06-29 (event subscription)

The WebSocket event-subscription deferral is lifted for persisted workspace
events. [[rpc-socket]] handles a single `events.subscribe` request after upgrade,
acknowledges it with a JSON-RPC result when the request has an `id`, and sends
later workspace [[Event]]s as `events.event` JSON-RPC notifications on the same
socket. Socket close is unsubscribe because spec §13 does not define
`events.unsubscribe`. SSE remains the HTTP live-event channel, while `POST /rpc`
continues rejecting stream commands through [[json-rpc-runtime]].

## Context

Spec §7 permits JSON-RPC 2.0 over stdio or WebSocket, while §13 defines the
method vocabulary. The implementation now has three separable layers:
[[json-rpc]] maps JSON-RPC method names to canonical ACP commands,
[[json-rpc-runtime]] executes those commands through an injected dispatch, and
[[rpc-endpoint]] exposes that runtime over HTTP `POST /rpc`.

The remaining question is whether v0.1 should also ship a WebSocket host now, or
whether stdio is the committed non-HTTP JSON-RPC framing for this phase.

## Decision

ACP v0.1 ships JSON-RPC over HTTP `POST /rpc` and stdio Content-Length framing.
WebSocket is deferred until there is a concrete integration that requires it and
until the server stack has an explicit, tested upgrade path. The current
`@effect/platform-node` socket support is sufficient for socket clients, but the
repo has not established a WebSocket server adapter beside `HttpServer.serve`.

This keeps JSON-RPC method compatibility, correlation, notifications, batch
folding, and auth forwarding in shared code while avoiding a second long-lived
transport whose event-stream semantics are not yet specified.

## Rationale

Stdio satisfies the spec's non-HTTP JSON-RPC option and matches common agent
host patterns without introducing another network listener. It is also easy to
test correctly because Content-Length framing is a pure byte protocol and actual
method execution already flows through `POST /rpc`.

WebSocket would need more decisions than just a socket upgrade. It must define
whether `events.subscribe` produces JSON-RPC notifications, how backpressure and
disconnects map to ACP sessions, how bearer auth is established, and whether it
duplicates or replaces SSE for live event delivery. Shipping it without those
answers would widen the [[Transport]] seam before the protocol benefits from the
extra adapter.

## Consequences

Tool integrations that need process-local JSON-RPC framing should use
`acp-jsonrpc-stdio`. Browser or service integrations can use `POST /rpc`,
`GET /rpc` WebSocket, or the REST/SSE surface. WebSocket is now an implemented
adapter for request/response plus workspace event notifications; host-presence
streams remain intentionally separate under
[[ADR-0005-worker-presence-scope]].

## Alternatives

Implement WebSocket immediately using a raw Node server upgrade path — rejected:
it would bypass the established Effect Platform server composition and create a
second transport shell with unproven lifecycle behavior.

Treat WebSocket as the default JSON-RPC transport — rejected: stdio and `POST
/rpc` already cover local agents and service clients with less operational
surface area.

## Validation

The stdio slice proved the chosen process-local framing path with pure
byte-framing tests and the existing `POST /rpc` runtime tests. The WebSocket
slices add real upgraded-socket tests for request/response, parse errors, and
`events.subscribe` receiving a later `events.event` notification.

## Referenced by

[[Transport]] · [[EventStream]] · [[architecture/_MOC]]
