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
- [[id-clock]] — id/timestamp minting primitive for the composition root.
- [[identity.test]] — ordinary id, ISO timestamp, and secure-token guarantees.
- [[acp-router]] — `HttpRouter` wiring all v0.1 routes to services + SSE + `/rpc`.
- [[router.test]] — aggregate bootstrap, auth, workspace/work, and review HTTP
  contract.
- [[artifact-routes.test]] — artifact evidence validation, update identity, and
  delete behavior on inline router handlers.
- [[lease-routes.test]] — lease read/mutation lifecycle and scope boundaries on
  inline router handlers.
- [[session-capabilities-test]] — focused HTTP regression for advertised host
  capability flags.
- [[route-support]] — shared authorization, response encoding, route error
  folding, and request lifecycle logging.
- [[resource-workspace-auth]] — derived workspace authorization for by-id HTTP
  mutation routes.
- [[workspace-routes]] — workspace list/create/update HTTP handlers.
- [[worker-routes]] — host-scoped worker registry read handlers.
- [[worker-routes.test]] — host-scoped list/get, scope, and not-found behavior.
- [[resume-routes]] — work-scoped read handlers for handoff and recovery.
- [[resume-workspace]] — salience budgeting + ETag digest that shapes the resume
  packet as a bounded global workspace.
- [[review-routes]] — review lifecycle mutation handlers (request/approve/reject
  /request-changes/cancel).
- [[review-comment-routes]] — diff-anchored review comment add/resolve/reopen
  /list handlers.
- [[review-comment-routes.test]] — anchored add, dual listing, resolve, and reopen.
- [[grill-routes]] — forced senior-question grill gate handlers (open/ask/answer
  /verdict/evaluate/get/list).
- [[grill-routes.test]] — complete blocker-question route flow to a passing gate.
- [[memory-routes]] — workspace memory create/list HTTP handlers.
- [[event-routes]] — workspace event replay and SSE stream handlers.
- [[event-routes.test]] — cursor/type/limit replay and read/binding authorization.
- [[rpc-endpoint]] — `POST /rpc` JSON-RPC framing over the in-process router.
- [[rpc-endpoint.test]] — shared-store RPC/REST, notification, batch, and error
  behavior.
- [[rpc-socket]] — `GET /rpc` JSON-RPC WebSocket framing over the same router.
- [[rpc-socket.test]] — real-upgrade auth, shared store, parse error, and event
  subscription behavior.
- [[native-rpc-route]] — `/rpc/native` Effect RPC HTTP route plus legacy route
  registration on the host layer router.
- [[http-app]] — socket-agnostic host layer (router + sweeper over app + id-clock).
- [[sweeper]] — background TTL eviction daemon (stale sessions, due leases).
- [[sweeper-leadership]] — in-process or Postgres advisory-lock guard for
  replicated sweeper ticks.
- [[server-main]] — Node `HttpServer` entrypoint on `ACP_PORT` with structured
  Effect logging.

## Referenced by

[[app/_MOC]] · [[src/_MOC]]
