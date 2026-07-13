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
  ├── EventBrokerLayer (in-process | pg-notify)
  │     └── EventStoreLayer (durable append + live publish)
  ├── WorkUnit / Worker / Workspace / Lease / Artifact / Checkpoint / Review services
  └── TransportLayer (seam)
        ├── REST + native Effect RPC
        └── SSE + WebSocket EventStream
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
| [[EventStream]] | CRITICAL (6)    | CRITICAL    | 0     | HEALTHY |
| [[GitHub]]      | EXPLORATORY (2) | EXPLORATORY | 0     | HEALTHY |

## Lifecycle Map

EXPLORATORY: Transport, GitHub · CRITICAL: Storage, EventStream ·
collapse-eligible: none.

## Chain Risk

None yet (no 3+ external-seam hops).

## Momentum (review quarterly)

Depth → · Coupling → · Debt → (baseline established 2026-06-25).

## Mirror Integrity

[[source-mirror-2026-07-10]] found 250 TypeScript source files, 157 mirrored
non-MOC pages, 97 missing mirrors (9 production/support modules + 88 tests), and
4 orphaned RPC pages caused by `-test.md` instead of `.test.md` naming. The nine
production/support modules are now distilled and the four RPC pages use exact
`.test.md` paths. The first bounded test batch now registers the app layer,
logging, stdio framing, and config profile contracts. The foundational CLI
client, registry, aggregate parser, event, lease, and work tests are also
registered. Focused multi-agent, GitHub bridge/merge/reconciliation, grill,
memory, and review-comment tests complete CLI parity. Subsequent bounded-resume
work added two server test sources with a mirrored production module. Health,
identity, aggregate REST, JSON-RPC HTTP, and JSON-RPC WebSocket tests are now
registered, leaving 64 missing test mirrors with no production gaps or orphans.
The depth distribution above is therefore an active-module baseline, not a
complete source inventory. Artifact, event, grill, lease, review-comment, and
worker route tests are registered. Resume handoff, ETag/budget, pure salience,
hosted binding, and workspace aggregate suites are also registered, leaving 53
missing tests. Real boot, both workspace authorization paths, native typed RPC,
and sweeper/leadership suites complete app/config parity, leaving 47 domain,
infrastructure, and protocol tests. Artifact, checkpoint, event broker/store,
grill, lease, and memory service suites are now registered, leaving 40 tests.
Review comment/review, session, WorkUnit, worker, and workspace suites complete
domain parity, leaving 34 infrastructure and protocol tests. Cross-cutting
infrastructure boundary suites now pin Postgres notification fan-out, the full
REST inventory, HTTP error secrecy, subprocess outcomes, and SSE framing. The
audit therefore leaves 29 infrastructure and protocol tests; JSON-RPC is the next
documentation-first slice. Focused JSON-RPC projections and the broad
facade/runtime suites are now registered, leaving 22 infrastructure and protocol
tests. Storage adapter, query, CAS, durability, plan, and retention contracts are
now registered, leaving 16 RPC/protocol tests. The first bounded RPC handler
batch now registers artifact, checkpoint, memory/event, review, and aggregate
session/workspace/work/lease behavior. Generated-client ergonomics, exact
contract metadata, and direct/derived workspace isolation suites complete
infrastructure parity. The final protocol suites and protocol folder MOCs first
closed the audit at 253 exact pairs. The review-collaboration authorization
boundary then added one production module and one focused test with their pages;
the current audit is 255 source files, 255 exact non-MOC pages, zero missing
mirrors, and zero orphans. The active production audit uses the existing
Dockerized ACP host directly; no separate provider runner is added.

## ADRs

- [[ADR-0001-architecture-foundation]] — ACCEPTED.
- [[ADR-0002-json-rpc-transport-framing]] — ACCEPTED.
- [[ADR-0004-protocol-version-codecs-generated-client]] — ACCEPTED.
- [[ADR-0005-worker-presence-scope]] — ACCEPTED.
- [[ADR-0008-deployment-storage-topology]] — ACCEPTED; Postgres/pg-notify,
  workspace-scoped auth, replicated sweeps, retention, Compose, and edge are
  landed; managed hosting and external identity remain deferred.
- [[ADR-0011-live-agent-docker-dogfood-runner]] — SUPERSEDED.
- [[ADR-0012-acp-self-agent-audit]] — ACCEPTED; real agents use the
  provider-neutral production ACP image directly as their coordination plane.
- [[ADR-0013-review-collaboration-permission]] — ACCEPTED; eight reviewer
  mutations use `review:collaborate`, worker answer alone uses `review:respond`,
  both scopes are rejected in one session, and a focused authorization module
  makes opaque targets scope-first/non-enumerating with fail-closed rotation and
  no invented RPC commands.
- [[ADR-0014-workspace-administration-authority]] — PROPOSED/BACKLOG; isolate
  host provisioning and workspace lifecycle authority as a separate slice.
- [[ADR-0015-trusted-session-issuance]] — PROPOSED/BACKLOG; replace the trusted-
  client hosted bootstrap assumption with verified identity and server-policy-
  derived sessions before public multi-tenant hosting.

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
16. ✅ WebSocket transport evaluation — HTTP/stdio first, later upgraded by slice 56
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
37. ✅ Permission scope parity for backed mutations — action scopes enforced
38. ✅ Post-permission integration audit — README drift selected
39. ✅ Public README current-state refresh — transport/auth/CLI prose updated
40. ✅ CLI parser dispatch table refactor — additive command registry
41. ✅ Post-parser integration audit — external artifact references selected
42. ✅ External artifact URI support — schema/service/REST/JSON-RPC/CLI
43. ✅ Post-artifact integration audit — work resume queries selected
44. ✅ Work resume query endpoints — work/checkpoints/latest/artifacts over REST/JSON-RPC/CLI
45. ✅ Effect observability logging — server JSON logs with config-driven level
    and safe annotations
46. ✅ Post-observability integration audit — review/content resume gap selected
47. ✅ Work review reads and artifact content read endpoints
48. ✅ Post-resume-read integration audit — workspace work index selected
49. ✅ Workspace work index read endpoint
50. ✅ Re-audit remaining integration gaps after workspace work index
51. ✅ Workspace aggregate resume reads for checkpoints, artifacts, and reviews
52. ✅ Re-audit remaining integration gaps after workspace aggregate reads
53. ✅ Lease renew/revoke transport parity
54. ✅ Re-audit remaining integration gaps after lease lifecycle parity
55. ✅ Public README refresh after lease lifecycle parity
56. ✅ WebSocket JSON-RPC request/response transport
57. ✅ Host-scoped worker presence reads
58. ✅ Re-audit remaining integration gaps after worker presence reads
59. ✅ JSON-RPC event subscription semantics over WebSocket
60. ✅ Re-audit remaining integration gaps after WebSocket event subscriptions
61. ✅ Workspace event replay reads
62. ▶ Review cancellation lifecycle
63. ✅ Native Effect RPC contract and session/read handler foundation
64. ✅ Native Effect RPC work/workspace command handlers
65. ✅ Re-audit remaining native RPC handler gaps after work/workspace handlers
66. ✅ Native Effect RPC lease handlers
67. ✅ Re-audit remaining native RPC handler gaps after lease handlers
68. ✅ Native Effect RPC artifact handlers
69. ✅ Re-audit remaining native RPC handler gaps after artifact handlers
70. ✅ Native Effect RPC checkpoint handlers
71. ✅ Re-audit remaining native RPC handler gaps after checkpoint handlers
72. ✅ Lease readback parity across REST, CLI, JSON-RPC, native RPC, and dogfood
73. ✅ GitHub bridge live sandbox dogfood — guarded real import/sync/thread
    resolution/denied-before-allowed merge with repeatable cleanup

## Referenced by

[[00-INDEX]]
