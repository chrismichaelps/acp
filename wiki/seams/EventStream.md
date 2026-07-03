---
type: seam
capacity: CRITICAL
capacity_score: 6
lifecycle: CRITICAL
drift_score: 0
drift_status: HEALTHY
production_adapters: 1
change_freq_per_quarter: 1
tags: [seam, critical]
aliases: [EventStream, SseEventStream]
---

# EventStream (seam)

## Classification

CRITICAL — live fan-out of [[Event]]s to subscribed [[Worker]]s. Server-Sent
Events remains the HTTP live adapter, and [[rpc-socket]] adds JSON-RPC
notification delivery for WebSocket clients that send `events.subscribe`. Host
or global worker presence is not part of this seam in v0.1;
[[ADR-0005-worker-presence-scope]] keeps presence in the worker registry until a
separate host-presence stream is justified.

## Interface

Backed by an Effect `PubSub` fed by the [[EventStore]]. A subscriber receives a
`Stream` of events filtered by workspace (and optionally type). The transport
adapter renders the stream into its wire format (SSE `event:`/`data:` frames).

## Adapters

| Adapter   | Type       | Path                               | Last verified | Status         |
| --------- | ---------- | ---------------------------------- | ------------- | -------------- |
| SSE       | production | @root/src/infrastructure/sse/      | 2026-06-26    | CURRENT (v0.1) |
| WebSocket | production | @root/src/app/server/rpc-socket.ts | 2026-06-29    | CURRENT        |

## Health

DRIFT 0 (HEALTHY). SSE adapter code-complete and tested (4 targeted tests: frame
shape, UTF-8 byte rendering, streaming response metadata, heartbeat comment).
WebSocket subscription is tested over a real upgraded socket by subscribing to a
workspace, publishing a later work event, and receiving an `events.event`
notification.

## Deepening

ADR: [[ADR-0001-architecture-foundation]],
[[ADR-0003-event-vocabulary-domain-boundaries]], and
[[ADR-0005-worker-presence-scope]]. Heartbeat interval from `ACP_SSE_HEARTBEAT`
for SSE; WebSocket unsubscribe is connection close until the protocol defines an
explicit unsubscribe method.

> **Cross-process fan-out (planned, [[ADR-0008-deployment-storage-topology]]).**
> The single in-process `PubSub` is process-local: a subscriber only receives
> events published by the same process, so live SSE/WebSocket fan-out is
> single-node today. ADR-0008 extracts an `EventBroker` `Context.Tag` behind the
> PubSub with `in-process` (current), `pg-notify` (Postgres `LISTEN/NOTIFY`, HA
> with no extra dependency), and optional `redis` adapters. The SSE/WebSocket
> adapters above are unchanged — they render whatever the broker yields.

## Referenced by

[[Event]] · [[event-store]] · [[sse-event-stream]] · [[architecture/_MOC]] ·
[[ADR-0003-event-vocabulary-domain-boundaries]] ·
[[ADR-0005-worker-presence-scope]]
