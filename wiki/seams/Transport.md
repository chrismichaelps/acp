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
| Adapter | Type | Path | Last verified | Status |
|---------|------|------|---------------|--------|
| HTTP+SSE | production | @root/src/infrastructure/http/ | — | PLANNED (v0.1) |
| JSON-RPC | production | @root/src/infrastructure/jsonrpc/ | — | FUTURE (v0.2 §13) |

## Health
DRIFT 0 (HEALTHY). Designed, not yet implemented.

## Deepening
ADR: [[ADR-0001-architecture-foundation]]. Built on `@effect/platform` `HttpApi`
declarative API (see [[grammar/typescript]]).

## Referenced by
[[Event]] · [[architecture/_MOC]]
