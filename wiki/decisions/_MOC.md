---
type: moc
tags: [moc, adr]
---

# Decisions MOC (ADRs)

- [[ADR-0001-architecture-foundation]] — ACCEPTED — name (ACP), layer topology,
  storage/transport seams, schema-first.
- [[ADR-0002-json-rpc-transport-framing]] — ACCEPTED — JSON-RPC ships over
  `POST /rpc` and stdio; WebSocket is deferred.
- [[ADR-0003-event-vocabulary-domain-boundaries]] — ACCEPTED — only
  persisted domain transitions emit public v0.1 events; worker presence,
  workspace archive, and artifact update need domain state before transport.
- [[ADR-0004-protocol-version-codecs-generated-client]] — ACCEPTED — centralize
  protocol-version negotiation now; defer standalone codecs and generated
  clients until a concrete boundary or consumer exists.

## Referenced by

[[00-INDEX]]
