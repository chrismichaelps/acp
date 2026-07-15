---
type: handoff
status: complete
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

## Implementation and Validation

- Shared REST/native initialization, static/trusted adapters, issuer provenance,
  revocation, durable binding registry, transport auth, subscription auth, and
  optional OpenAPI issuance security are implemented and wired through
  `AppLive`; no new orchestration `.mjs` exists.
- The production-image static proof covers CLI, JSON-RPC HTTP, stdio,
  header-authenticated WebSocket, native Effect RPC, minted query sessions,
  denied query issuance, subscription scope/binding, revision restart, durable
  remap denial, and structured audit redaction.
- Docker self-use exposed a real framework access-log leak for query bearer
  values. [[http-app]] now disables the duplicate raw-URL logger; the structured
  audit proof passes and ACP's template-based request telemetry remains active.
- Clean Linux gate: 122 test files / 674 tests passed, 13 skipped by environment;
  lint, formatting, typecheck, file-size, env, permission-doc, edge-pin, and the
  157-file production build passed.
- Production Docker gates: static issuance plus recovery quickstart and
  two-replica HA passed in the aggregate run; SQLite and two-replica HA edge
  smoke passed after checkpointing and briefly stopping the persisted
  `acp-self-openapi` control plane to release its fixed host port. The same ACP
  container restarted healthy with its state intact.
- Exact-head aggregate `issue329exact` repeated the complete production-image
  proof after the security repairs: SQLite lifecycle and six transports,
  hardened auth/static issuance, restart recovery, two-replica HA, SQLite edge,
  and two-replica HA edge all passed. The Docker ACP control plane retained
  checkpoint `checkpoint_mrmcctok1` and returned healthy after the gate.
- Source mirror audit: 270 source files, 270 exact non-MOC pages, zero missing,
  zero orphaned. The user-owned untracked `install.sh` remains untouched.
- Independent security review found two release blockers before publication:
  native RPC middleware collapsed an authorized session to its worker id and
  therefore lost workspace bindings, while the durable attribution registry was
  partitioned by issuer id and could release a historical worker id after an
  issuer rename. The documentation-first repair retains the full native actor,
  checks its workspace in each scoped handler, and stores every issuer/principal
  tuple plus globally unique worker ids in one CAS-protected registry row.
  Generated-client and cross-issuer regression tests pass on clean Linux; the
  corresponding production-container probes are part of the exact-head Docker
  gate.
- Independent security re-review approved both repairs and found no new
  security or correctness blockers.
- Docker ACP registered PR artifact `artifact_mrmcmcju1`; role-separated grill
  `grill_mrmcmzal3` passed three fixed-grant, attribution/workspace, and
  exact-evidence questions with no blocking items; review
  `review_mrmcmdvd2` is approved.

## Closure

- PR #334 passed Local Gates and Complete Docker self-dogfood, then
  squash-merged to `main` at `0057fec9e227dfb03d5d673c50f449d4c483b470`.
- Issue #329 is closed with the final validation and ACP review evidence.
- Docker ACP checkpoint `checkpoint_mrmcw9tj7` records the merge, and work
  `work_mrm981wa4` is completed.
- The remote feature branch is deleted; the user-owned untracked `install.sh`
  remains untouched.

## Referenced by

[[ADR-0015-trusted-session-issuance]] · [[trusted-session-issuance]]
