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
        └── SseEventStreamLayer
```

## Depth Distribution (target 60 DEEP / 30 MEDIUM / 10 SHALLOW)
| status | count |
|--------|-------|
| DEEP | 5 |
| MEDIUM | 9 |
| SHALLOW | 0 |
_14 schema-slice modules distilled. DEEP: [[ids]] [[common]] [[event.schema]]
[[protocol-error]] [[app-config]]. Distribution skews DEEP/MEDIUM (no shallow
pass-throughs) — healthy for a schema layer._

## Seam Health Table
| Seam | Capacity | Lifecycle | Drift | Status |
|------|----------|-----------|-------|--------|
| [[Storage]] | CRITICAL (6) | CRITICAL | 0 | HEALTHY |
| [[Transport]] | CRITICAL (5) | EXPLORATORY | 0 | HEALTHY |
| [[EventStream]] | EXPLORATORY (3) | EXPLORATORY | 0 | HEALTHY |

## Lifecycle Map
EXPLORATORY: Transport, EventStream · CRITICAL: Storage · collapse-eligible: none.

## Chain Risk
None yet (no 3+ external-seam hops).

## Momentum (review quarterly)
Depth → · Coupling → · Debt → (baseline established 2026-06-25).

## ADRs
- [[ADR-0001-architecture-foundation]] — ACCEPTED.

## Build Order (vertical slices)
1. ✅ Governance scaffold (vault, grammar, domain, seams, ADR-0001)
2. ✅ Protocol Schema (`wiki/src/protocol/schema/*`) + Config + Errors — 14 tests green
3. ▶ Storage seam + InMemory adapter
4. ☐ EventStore (PubSub) service
5. ☐ Domain services (WorkUnit first — state machine)
6. ☐ HTTP transport (HttpApi) + error mapper
7. ☐ SSE event stream
8. ☐ CLI client + server main

## Referenced by
[[00-INDEX]]
