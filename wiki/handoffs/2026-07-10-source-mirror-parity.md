---
date: 2026-07-10
topic: source-mirror-parity
from_role: Forensic Guardian
to_role: DNA Engineer
status: COMPLETE
maturity: STABLE
tags: [handoff]
---

# Handoff — Source Mirror Parity

## Done

- Measured [[source-mirror-2026-07-10]]: initial 250 source files, 157 mirrored
  pages, 97 missing, and 4 orphaned pages.
- Distilled all 9 unregistered production/support modules; missing production is
  now zero and total missing is 88 (all tests).
- Defined [[Host]], [[Grill]], and [[ReviewComment]] and added missing Audits,
  Grills, and Review Comments MOCs.
- Reconciled affected CLI, server, domain, events, HTTP, RPC, router, and API
  linkage. Exact path audit and Prettier pass.
- Renamed the four RPC roundtrip pages to exact `.test.md` mirror paths,
  retained their legacy `-test` aliases, and reconciled repository backlinks.
  The bidirectional audit now reports 84 missing test mirrors and 0 orphans.
- Distilled the app layer, logging, stdio frame, and config executable contracts;
  added `config/_MOC` and reconciled source/module backlinks. The audit now
  reports 80 missing test mirrors and 0 orphans.
- Distilled the foundational CLI client, registry, aggregate parser, event,
  lease, and work tests and reconciled CLI module/MOC links. The audit now
  reports 74 missing test mirrors and 0 orphans.
- Distilled the remaining multi-agent, GitHub bridge/merge/reconciliation,
  grill, memory, and review-comment CLI tests. CLI test parity is complete and
  rebased over the new bounded-resume sources. The audit now reports 69 missing
  test mirrors and 0 orphans.
- Distilled health, identity, aggregate REST router, JSON-RPC HTTP, and real
  WebSocket server tests. The audit now reports 64 missing test mirrors and 0
  orphans.
- Distilled artifact, event, grill, lease, review-comment, and worker route
  tests. The audit now reports 58 missing test mirrors and 0 orphans.
- Distilled resume composition, ETag/budget routes, pure salience/pinning,
  hosted session binding, and workspace aggregate tests. The audit now reports
  53 missing test mirrors and 0 orphans.
- Distilled real boot, direct/derived workspace authorization, native typed RPC,
  sweeper leadership, expiry/retention, and direct workspace scope tests.
  App/config parity is complete; 47 test mirrors remain.
- Distilled artifact, checkpoint, event broker/store, grill, lease, and memory
  domain suites. 40 test mirrors remain.
- Distilled review comment/review, session, WorkUnit, worker, and workspace
  domain suites. Domain parity is complete; 34 test mirrors remain.
- Distilled cross-process Postgres event delivery, the reflected v0.1 REST
  inventory, HTTP error secrecy, subprocess outcome normalization, and SSE
  framing. Corrected the process adapter's owning page to cover `runProcess`.
  Infrastructure debt is now 24 tests; 29 total test mirrors remain.
- Distilled focused JSON-RPC lease, memory, resume, review, and worker mappings;
  broad envelope/id/error semantics; and runtime batch, notification, stream,
  live-router, and authorization behavior. Infrastructure debt is now 17 tests;
  22 total test mirrors remain.
- Distilled InMemory/SQLite/Postgres storage behavior, promoted columns, shared
  query/version-CAS conformance, durable reopen, query plans, large-tail reads,
  and retention. Restored `pruneEventsBefore` and newest-event watermark rules to
  the seam and adapter pages. Infrastructure debt is now 11 tests; 16 total test
  mirrors remain.
- Distilled native RPC artifact, checkpoint, memory/event, review, and aggregate
  session/binding/workspace/work/lease handler behavior, including direct domain
  dispatch, typed errors, scoped denial, and middleware actor precedence.
  Infrastructure debt is now 6 tests; 11 total test mirrors remain.
- Distilled native RPC generated-client URL/bearer helpers, exact operation and
  middleware metadata, direct workspace isolation, and derived evidence/review/
  work/lease tenancy. Infrastructure parity is complete; 5 protocol test mirrors
  remain.
- Distilled the final error, grill, review-comment, aggregate schema, and version
  suites; added protocol/errors/schema MOCs. Exact parity is now 253 source files
  to 253 non-MOC pages, with zero missing mirrors and zero orphans.

## Decided (do not re-litigate)

- Tests require 1:1 mirrors because they are executable behavior contracts.
- Repair the four RPC orphan paths before authoring new test pages.
- Land remaining test parity in bounded area-based slices, not one bulk dump.
- Add a CI mirror check only after missing/orphan counts reach zero.

## Open / Remaining

- None. The source-mirror restoration objective is complete.

## Exact next action

Forensic Guardian: preserve the zero-drift baseline while the next feature is
designed. The active product request is a real model-backed Docker ACP dogfood
runner; document its provider-neutral external-runner boundary and acceptance
evidence before changing the harness or package scripts.

## Links

[[source-mirror-2026-07-10]] · [[architecture/_MOC]] · [[rpc/_MOC]] ·
[[grammar/typescript]]
