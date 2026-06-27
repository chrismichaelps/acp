---
type: adr
status: ACCEPTED
date: 2026-06-27
tags: [adr, transport, json-rpc]
aliases: [ADR-0002, ADR-0002-json-rpc-transport-framing]
---

# ADR-0002 — JSON-RPC Transport Framing

## Status

ACCEPTED — 2026-06-27.

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

Tool integrations that need a stream-oriented JSON-RPC process should use
`acp-jsonrpc-stdio`. Browser or service integrations can use `POST /rpc` or the
REST/SSE surface. WebSocket remains a deliberate future adapter, not an implicit
gap in the current v0.1 transport.

Before WebSocket lands, the implementation needs a focused design note for
authentication, event subscription semantics, heartbeat/backpressure behavior,
and test strategy over a real upgraded connection.

## Alternatives

Implement WebSocket immediately using a raw Node server upgrade path — rejected:
it would bypass the established Effect Platform server composition and create a
second transport shell with unproven lifecycle behavior.

Treat WebSocket as the default JSON-RPC transport — rejected: stdio and `POST
/rpc` already cover local agents and service clients with less operational
surface area.

## Validation

The stdio slice proves the chosen non-HTTP framing path with 149 tests green,
including pure byte-framing tests and the existing `POST /rpc` runtime tests.
WebSocket has no production adapter in v0.1 and remains documented as deferred.

## Referenced by

[[Transport]] · [[EventStream]] · [[architecture/_MOC]]
