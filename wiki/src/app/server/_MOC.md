---
type: moc
tags: [moc, src, app, server]
---

# Server Source MOC

Mirror of `@root/src/app/server/`. The HTTP transport entrypoint binding
[[acp-http-api]] to the domain services.

- [[server-index]] — opaque server barrel (router + id-clock + http-app).
- [[health-routes]] — unauthenticated Host liveness/readiness probes.
- [[health-routes.test]] — public liveness/readiness registration and response
  contract.
- [[openapi-route]] — unauthenticated, in-memory `GET /openapi.json` discovery
  handler.
- [[openapi-route.test]] — production-router wiring, JSON response, and method
  boundary contract.
- [[id-clock]] — id/timestamp minting primitive for the composition root.
- [[identity.test]] — ordinary id, ISO timestamp, and secure-token guarantees.
- [[acp-router]] — `HttpRouter` wiring all v0.1 routes to services + SSE + `/rpc`.
- [[router.test]] — aggregate bootstrap with exact permission/binding echo, auth,
  workspace/work, and review HTTP contract.
- [[artifact-routes.test]] — artifact evidence validation, update identity, and
  delete behavior on inline router handlers.
- [[lease-routes.test]] — lease read/mutation lifecycle and scope boundaries on
  inline router handlers.
- [[session-capabilities-test]] — focused HTTP regression for advertised host
  capability flags.
- [[session-initializer]] — transport-neutral handshake normalization, trusted
  issuance, worker registration, secure minting, and exact grant projection.
- [[session-initializer.test]] — shared transaction ordering and projection
  contract.
- [[session-issuance.test]] — live hostile-client issuance, revocation, and audit
  secrecy contract.
- [[route-support]] — shared authorization, response encoding, route error
  folding, and request lifecycle logging.
- [[resource-workspace-auth]] — established generic derived-workspace
  authorization for opaque resource ids.
- [[review-collaboration-auth]] — focused scope-first, non-enumerating opaque
  review/comment/grill/question target authorization.
- [[review-collaboration-auth.test]] — helper-level scope ordering, target
  derivation, and missing/foreign equivalence contract.
- [[mutation-workspace-scope-routes.test]] — cross-tenant denial across every
  by-id mutation family.
- [[workspace-scope-routes.test]] — direct work/artifact/checkpoint workspace
  binding enforcement.
- [[workspace-routes]] — workspace list/create/update HTTP handlers.
- [[workspace-routes.test]] — isolated work/evidence indexes, scope, and binding.
- [[worker-routes]] — host-scoped worker registry read handlers.
- [[worker-routes.test]] — host-scoped list/get, scope, and not-found behavior.
- [[resume-routes]] — work-scoped read handlers for handoff and recovery.
- [[resume-routes.test]] — complete handoff composition, gate backlog, auth, and
  missing-content behavior.
- [[resume-workspace]] — salience budgeting + ETag digest that shapes the resume
  packet as a bounded global workspace.
- [[resume-workspace.test]] — pure budget, pinning, elision, and digest contract.
- [[resume-workspace-routes.test]] — HTTP ETag revalidation and budgeted/full
  representations.
- [[session-workspace-binding.test]] — hosted session initialization requires a
  non-empty workspace binding.
- [[review-routes]] — review lifecycle mutation handlers (request/approve/reject
  /request-changes/cancel).
- [[review-comment-routes]] — target-bound `review:collaborate` handlers for
  comment add/resolve/reopen/external-id plus read lists.
- [[review-comment-routes.test]] — all four mutation scopes, identity mismatch,
  missing/foreign 404 equivalence, responder denial, and read/list behavior.
- [[grill-routes]] — `review:collaborate` reviewer handlers plus isolated
  `review:respond` worker answer with non-enumerating opaque targets.
- [[grill-routes.test]] — five mutation scopes, per-session responder/
  adjudicator separation, exact errors, and a passing gate.
- [[memory-routes]] — workspace memory create/list HTTP handlers.
- [[event-routes]] — workspace event replay and SSE stream handlers.
- [[event-routes.test]] — cursor/type/limit replay and read/binding authorization.
- [[rpc-endpoint]] — `POST /rpc` JSON-RPC framing over the in-process router.
- [[rpc-endpoint.test]] — shared-store RPC/REST, notification, batch, and error
  behavior.
- [[rpc-socket]] — `GET /rpc` JSON-RPC WebSocket framing, header-only issuance,
  and authorized event subscription over the same router.
- [[rpc-socket.test]] — real-upgrade auth, shared store, parse error, and event
  subscription behavior.
- [[native-rpc-route]] — `/rpc/native` Effect RPC HTTP route plus legacy route
  registration on the host layer router.
- [[native-rpc-route.test]] — live typed-client unary/stream parity and shared
  REST state.
- [[http-app]] — socket-agnostic host layer (router + sweeper over app + id-clock).
- [[live-boot.test]] — real ephemeral TCP boot through health/session/work flow.
- [[sweeper]] — background TTL eviction daemon (stale sessions, due leases).
- [[sweeper.test]] — deterministic expiry, leadership skip/run, and retention.
- [[sweeper-leadership]] — in-process or Postgres advisory-lock guard for
  replicated sweeper ticks.
- [[sweeper-leadership.test]] — local execution and fail-fast Postgres config.
- [[server-main]] — Node `HttpServer` entrypoint on `ACP_PORT` with structured
  Effect logging.

## Referenced by

[[app/_MOC]] · [[src/_MOC]]
