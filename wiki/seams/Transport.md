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

CRITICAL — the protocol boundary between [[Worker]] clients and the [[Host]]. One
production adapter in v0.1 (HTTP + SSE); JSON-RPC is a confirmed v0.2 adapter
(spec §13, §21). On a core path (all commands cross it), so failure = system
failure, but variation is still emerging — lifecycle EXPLORATORY.

## Interface

Transport adapters translate wire requests into decoded protocol payloads, invoke
domain services, and encode protocol responses + protocol errors. Domain services
are transport-agnostic — they never see HTTP or JSON-RPC types. The decode →
delegate → encode → error-map boundary is mandatory (spec §16.8).

## Adapters

| Adapter  | Type       | Path                                                     | Last verified | Status                       |
| -------- | ---------- | -------------------------------------------------------- | ------------- | ---------------------------- |
| HTTP     | production | @root/src/infrastructure/http/                           | 2026-06-26    | API CONTRACT CURRENT         |
| SSE      | production | @root/src/infrastructure/sse/                            | —             | PLANNED (v0.1 stream)        |
| JSON-RPC | production | @root/src/infrastructure/jsonrpc/ + @root/src/app/stdio/ | 2026-06-27    | HTTP + STDIO FRAMING CURRENT |

## Health

DRIFT 0 (HEALTHY). HTTP API declaration, error mapper, `POST /rpc`, JSON-RPC
method normalization, runtime folding, and stdio Content-Length framing are
code-complete for the current v0.1 transport surface. WebSocket host execution
remains speculative.

## Deepening

ADR: [[ADR-0001-architecture-foundation]]. Built on `@effect/platform` `HttpApi`
declarative API (see [[grammar/typescript]]).

## Referenced by

[[Event]] · [[acp-http-api]] · [[http-error-mapper]] · [[json-rpc]] ·
[[stdio-main]] · [[architecture/_MOC]]
