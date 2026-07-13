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
  persisted domain transitions emit public v0.1 events; event names need domain
  state before transport.
- [[ADR-0004-protocol-version-codecs-generated-client]] — ACCEPTED — centralize
  protocol-version negotiation now; defer standalone codecs and generated
  clients until a concrete boundary or consumer exists.
- [[ADR-0005-worker-presence-scope]] — ACCEPTED — worker presence is host-scoped
  registry state in v0.1, not workspace event history.
- [[ADR-0007-effect-rpc-adoption]] — ACCEPTED — adopt @effect/rpc over the domain
  services and retire the hand-mapped JSON-RPC layer; clients are first-party
  Effect/TS, so JSON-RPC 2.0 wire compatibility is dropped.
- [[ADR-0008-deployment-storage-topology]] — ACCEPTED — one binary, three
  config-selected seams (Storage / EventBroker / Auth) and named deployment
  profiles; Postgres storage, pg-notify fan-out, scoped bearer sessions, HA
  sweeper leadership, retention, and the optional edge tier are implemented;
  Redis, external identity/OIDC, managed hosting, and release operations remain
  deferred or partial; serverless is out for the runtime.
- [[ADR-0009-workspace-scoped-sessions]] — ACCEPTED — hosted ACP sessions carry
  optional workspace bindings; permission scopes say what a session may do,
  workspace bindings say where it may do it.
- [[ADR-0010-context-exchange-optimization]] — ACCEPTED — Feature 580: indexed/
  queryable Storage port (kill full-collection scans), version-column CAS,
  content-addressed blob dedup, immutable delta-based handoff, runtime grill
  protocol, reusable context blocks, opt-in semantic recall. Scale tier first.
- [[ADR-0011-live-agent-docker-dogfood-runner]] — SUPERSEDED — retained as the
  rejected provider-runner design history.
- [[ADR-0012-acp-self-agent-audit]] — ACCEPTED — use the existing production ACP
  Docker host directly as the control plane for real-agent repository audits.

## Referenced by

[[00-INDEX]]
