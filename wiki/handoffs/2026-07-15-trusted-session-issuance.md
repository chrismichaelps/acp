---
type: handoff
status: active
date: 2026-07-15
issue: 329
tags: [handoff, auth, hosted, security]
aliases: [2026-07-15-trusted-session-issuance]
---

# Trusted Session Issuance Handoff

## Recovered Work

- Issue #329; branch `feat/trusted-session-issuance` from merge `4938a8d`.
- Docker ACP workspace `workspace_mrlaz3fq1`; work `work_mrm981wa4` is running
  under `agent_issuance_worker_329`.
- Issue #328 / PR #333 is merged and closed; its ACP review/grill/work are
  approved, passed, and completed.

## Accepted Design

[[ADR-0015-trusted-session-issuance]] is ACCEPTED. It selects a
configuration-driven [[SessionIssuance]] seam with trusted-client compatibility
and a static service-identity adapter. Static grants are server-owned, bootstrap
credentials are configured only as SHA-256 digests, sessions persist principal
revision provenance, every later request validates current policy, and hosted
startup fails closed.

All transports reuse `Authorization: Bearer`: issuance credential during
initialize, ACP session id afterward. No new route, protocol version, provider
runner, or orchestration `.mjs` is introduced.

## Implementation Order

1. Add complete source-mirror pages and config/policy schemas.
2. Add the domain issuer port and static/trusted live adapter with focused
   hostile-input tests.
3. Persist issuance provenance plus an atomic immutable principal↔worker
   registry, and validate current policy before REST/native RPC scopes.
4. Route REST and native initialization through the shared issuer; legacy
   JSON-RPC/WebSocket/stdio inherit the same Authorization forwarding. Restrict
   WebSocket issuance to header credentials and authorize `events.subscribe`
   with `event:read`, workspace binding, and issuer validation.
5. Publish optional issuance auth in OpenAPI and regenerate the artifact.
6. Extend existing Docker self-dogfood auth probes for hostile fields,
   cross-transport parity, audit secrecy, and restart revocation.
7. Run clean Linux, source/wiki parity, independent review, ACP grill/review,
   PR, exact-head CI, merge, and issue closure.

## Acceptance Evidence Required

- local bootstrap unchanged;
- static/hosted invalid configuration cannot become ready;
- missing/wrong credential denied identically;
- hostile identity/scopes/bindings replaced by the fixed grant;
- one principal cannot split review roles across sessions;
- old session denied after revision change and real restart;
- REST, native RPC, JSON-RPC HTTP/WebSocket, and stdio parity;
- WebSocket no-token/missing-scope/foreign-binding/revoked-session subscription
  denial, with no query-string issuance credential;
- immutable principal↔worker mapping survives restart/deprovisioning;
- structured audit fields present with no credential/digest/session token;
- no unrelated change to the user-owned untracked `install.sh`.

## Architecture Review Findings

The read-only architecture agent found three contracts now folded into the
design:

1. existing WebSocket `events.subscribe` bypasses scope/workspace auth;
2. query-string bootstrap credentials would leak through URLs/logs;
3. current-policy-only uniqueness permits later historical worker remapping.

Docker ACP memory `memory_mrm9ldmw5` records the transport finding. The repair
adds subscription authorization, header-only WS issuance, canonicalized grants,
sanitized policy failures, and a durable bidirectional principal/worker registry.

## Referenced by

[[ADR-0015-trusted-session-issuance]] · [[trusted-session-issuance]]
