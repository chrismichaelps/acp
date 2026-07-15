---
type: seam
capacity: CRITICAL
capacity_score: 5
lifecycle: EXPLORATORY
drift_score: 0
drift_status: HEALTHY
production_adapters: 1
change_freq_per_quarter: 1
tags: [seam, critical]
aliases: [Transport, TransportLayer]
---

# Transport (seam)

## Classification

CRITICAL — the protocol boundary between [[Worker]] clients and the [[Host]].
HTTP+SSE, `POST /rpc`, stdio JSON-RPC, and `GET /rpc` WebSocket JSON-RPC are
current adapters. WebSocket request/response framing supersedes the deferral in
[[ADR-0002-json-rpc-transport-framing]] (see that ADR's Update), and WebSocket
`events.subscribe` now delivers persisted workspace events as JSON-RPC
notifications. SSE remains the HTTP live channel. Event vocabulary that lacks
persisted domain state is deferred by
[[ADR-0003-event-vocabulary-domain-boundaries]]. On a core path (all commands
cross it), so failure = system failure, but variation is still emerging —
lifecycle EXPLORATORY.

The typed REST surface is also projected as `openapi.json` and served publicly at
`GET /openapi.json` under [[ADR-0017-openapi-contract-artifact]]. That projection
declares `AcpSession` bearer security for protected operations while keeping only
session initialization public; it describes the current transport credential,
not trusted hosted identity.

## Interface

Transport adapters translate wire requests into decoded protocol payloads, invoke
domain services, and encode protocol responses + protocol errors. Domain services
are transport-agnostic — they never see HTTP or JSON-RPC types. The decode →
delegate → encode → error-map boundary is mandatory (spec §16.8).

## Adapters

| Adapter  | Type       | Path                                                             | Last verified | Status                            |
| -------- | ---------- | ---------------------------------------------------------------- | ------------- | --------------------------------- |
| HTTP     | production | @root/src/infrastructure/http/                                   | 2026-06-26    | API CONTRACT CURRENT              |
| SSE      | production | @root/src/infrastructure/sse/                                    | —             | PLANNED (v0.1 stream)             |
| JSON-RPC | production | @root/src/infrastructure/jsonrpc/ + @root/src/app/{stdio,server} | 2026-06-29    | HTTP + STDIO + WS FRAMING CURRENT |

## Health

DRIFT 0 (HEALTHY). HTTP API declaration, error mapper, `POST /rpc`, JSON-RPC
method normalization, runtime folding, stdio Content-Length framing, and the
`GET /rpc` WebSocket upgrade ([[rpc-socket]]) are code-complete for the current
transport surface. WebSocket request/response now reuses the in-process router via
the shared `dispatchVia` (connection-bound bearer, header or `?token=`), and
WebSocket `events.subscribe` emits `events.event` notifications from the existing
[[EventStore]] subscription.

## Deepening

ADR: [[ADR-0001-architecture-foundation]] and
[[ADR-0002-json-rpc-transport-framing]] and
[[ADR-0003-event-vocabulary-domain-boundaries]] and
[[ADR-0017-openapi-contract-artifact]]. Built on `@effect/platform` `HttpApi`
declarative API (see [[grammar/typescript]]).

## Referenced by

[[Event]] · [[acp-http-api]] · [[http-error-mapper]] · [[json-rpc]] ·
[[stdio-main]] · [[rpc-socket]] · [[architecture/_MOC]] ·
[[ADR-0003-event-vocabulary-domain-boundaries]] ·
[[ADR-0017-openapi-contract-artifact]] · [[openapi-module]] · [[openapi-route]]
