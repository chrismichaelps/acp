---
type: moc
tags: [moc, architecture]
---

# Architecture MOC — Governance Dashboard

Lean dashboard (FMCF Section V). Maturity: **EXPLORING** → ceremony minimal,
deepening SKIP/SELECTIVE, ADRs light.

## Layer Topology (ADR [[ADR-0001-architecture-foundation]])

```
ConfigLayer
  ├── LoggerLayer
  ├── StorageLayer (seam)
  │     └── EventStoreLayer
  ├── WorkUnit / Worker / Workspace / Lease / Artifact / Checkpoint / Review services
  └── TransportLayer (seam)
        ├── HttpApiLayer
        ├── JsonRpcCore
        └── SseEventStreamLayer
```

## Depth Distribution (target 60 DEEP / 30 MEDIUM / 10 SHALLOW)

| status  | count |
| ------- | ----- |
| DEEP    | 11    |
| MEDIUM  | 15    |
| SHALLOW | 0     |

_26 source modules distilled across schema, config, storage, events, work units,
HTTP, and SSE. DEEP:
[[ids]] [[common]] [[event.schema]] [[protocol-error]] [[app-config]] [[storage]]
[[in-memory-store]] [[event-store]] [[work-unit-service]] [[http-error-mapper]]
[[sse-event-stream]]. Distribution remains DEEP/MEDIUM with no shallow
pass-throughs._

## Seam Health Table

| Seam            | Capacity        | Lifecycle   | Drift | Status  |
| --------------- | --------------- | ----------- | ----- | ------- |
| [[Storage]]     | CRITICAL (6)    | CRITICAL    | 0     | HEALTHY |
| [[Transport]]   | CRITICAL (5)    | EXPLORATORY | 0     | HEALTHY |
| [[EventStream]] | EXPLORATORY (3) | EXPLORATORY | 0     | HEALTHY |

## Lifecycle Map

EXPLORATORY: Transport, EventStream · CRITICAL: Storage · collapse-eligible: none.

## Chain Risk

None yet (no 3+ external-seam hops).

## Momentum (review quarterly)

Depth → · Coupling → · Debt → (baseline established 2026-06-25).

## ADRs

- [[ADR-0001-architecture-foundation]] — ACCEPTED.
- [[ADR-0002-json-rpc-transport-framing]] — ACCEPTED.
- [[ADR-0004-protocol-version-codecs-generated-client]] — ACCEPTED.
- [[ADR-0005-worker-presence-scope]] — ACCEPTED.

## Build Order (vertical slices)

1. ✅ Governance scaffold (vault, grammar, domain, seams, ADR-0001)
2. ✅ Protocol Schema (`wiki/src/protocol/schema/*`) + Config + Errors — 14 tests green
3. ✅ Storage seam + InMemory adapter — 20 tests green
4. ✅ EventStore (PubSub) service — 24 tests green
5. ✅ Domain services (WorkUnit first — state machine) — 31 tests green
6. ✅ HTTP transport (HttpApi) + error mapper — 34 tests green
7. ✅ SSE event stream — 38 tests green
8. ✅ AppLive dependency graph + server main + CLI client — 97 tests green
9. ✅ Persistent storage adapter — 118 tests green
10. ✅ Persistent storage host selection — 119 tests green
11. ✅ JSON-RPC transport core — 130 tests green
12. ✅ Public README canonicalization — 130 tests green
13. ✅ JSON-RPC runtime execution core — 138 tests green
14. ✅ JSON-RPC HTTP `/rpc` framing — 144 tests green
15. ✅ JSON-RPC stdio framing bridge — 149 tests green
16. ✅ WebSocket transport evaluation — deferred by ADR-0002
17. ✅ Protocol coverage audit — command parity gaps identified
18. ✅ JSON-RPC progress event method — 151 tests green
19. ✅ Review action transport routes — 154 tests green
20. ✅ Capability negotiation compatibility — 157 tests green
21. ✅ Artifact delete transport route — focused gate green
22. ✅ Event vocabulary domain decisions — ADR-0003 accepted
23. ✅ Spec naming canonicalization note — tracked interpretation rule
24. ✅ Fresh protocol implementation audit — file-size gate identified
25. ✅ JSON-RPC module split + file-size gate — 160 tests green
26. ✅ CI gate for lint/typecheck/file-size/tests — workflow added
27. ✅ Formatting drift cleanup — repo-wide format check green
28. ✅ Protocol version/codecs/generated-client decision — explicit handshake module
29. ✅ Workspace mutation transport commands — REST + JSON-RPC backed by domain events
30. ✅ Workspace archive lifecycle — persisted state + REST/JSON-RPC command
31. ✅ JSON-RPC command-map capacity split — support helpers extracted
32. ✅ Artifact update lifecycle — metadata/content replacement + event
33. ✅ Worker presence event scope decision — host-scoped registry state
34. ✅ Protocol implementation audit refresh — CLI parity gap selected
35. ✅ CLI parity for backed commands — local command coverage
36. ✅ Post-CLI integration audit — permission scope parity selected
37. ▶ Permission scope parity for backed mutations

## Referenced by

[[00-INDEX]]
