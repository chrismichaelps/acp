---
type: seam
capacity: EXPLORATORY
capacity_score: 3
lifecycle: EXPLORATORY
drift_score: 0
drift_status: HEALTHY
production_adapters: 1
change_freq_per_quarter: 1
tags: [seam, exploratory]
aliases: [EventStream, SseEventStream]
---

# EventStream (seam)

## Classification

EXPLORATORY — live fan-out of [[Event]]s to subscribed [[Worker]]s. One production
adapter in v0.1 (Server-Sent Events). WebSocket is speculative (spec §7 mentions it
but no committed adapter), so the variation is not yet confirmed — keep simple,
promote to CRITICAL only when a second adapter lands.

## Interface

Backed by an Effect `PubSub` fed by the [[EventStore]]. A subscriber receives a
`Stream` of events filtered by workspace (and optionally type). The transport
adapter renders the stream into its wire format (SSE `event:`/`data:` frames).

## Adapters

| Adapter   | Type       | Path                          | Last verified | Status           |
| --------- | ---------- | ----------------------------- | ------------- | ---------------- |
| SSE       | production | @root/src/infrastructure/sse/ | 2026-06-26    | CURRENT (v0.1)   |
| WebSocket | —          | —                             | —             | SPECULATIVE (§7) |

## Health

DRIFT 0 (HEALTHY). SSE adapter code-complete and tested (4 targeted tests: frame
shape, UTF-8 byte rendering, streaming response metadata, heartbeat comment).
Handler/server route wiring remains in the HTTP server slice.

## Deepening

ADR: [[ADR-0001-architecture-foundation]]. Heartbeat interval from
`ACP_SSE_HEARTBEAT`.

## Referenced by

[[Event]] · [[event-store]] · [[sse-event-stream]] · [[architecture/_MOC]]
