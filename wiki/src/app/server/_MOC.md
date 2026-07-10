---
type: moc
tags: [moc, src, app, server]
---

# Server Source MOC

Mirror of `@root/src/app/server/`. The HTTP transport entrypoint binding
[[acp-http-api]] to the domain services.

- [[server-index]] — opaque server barrel (router + id-clock + http-app).
- [[health-routes]] — unauthenticated Host liveness/readiness probes.
- [[id-clock]] — id/timestamp minting primitive for the composition root.
- [[acp-router]] — `HttpRouter` wiring all v0.1 routes to services + SSE + `/rpc`.
- [[session-capabilities-test]] — focused HTTP regression for advertised host
  capability flags.
- [[route-support]] — shared authorization, response encoding, route error
  folding, and request lifecycle logging.
- [[resource-workspace-auth]] — derived workspace authorization for by-id HTTP
  mutation routes.
- [[workspace-routes]] — workspace list/create/update HTTP handlers.
- [[worker-routes]] — host-scoped worker registry read handlers.
- [[resume-routes]] — work-scoped read handlers for handoff and recovery.
- [[resume-workspace]] — salience budgeting + ETag digest that shapes the resume
  packet as a bounded global workspace.
- [[review-routes]] — review lifecycle mutation handlers (request/approve/reject
  /request-changes/cancel).
- [[review-comment-routes]] — diff-anchored review comment add/resolve/reopen
  /list handlers.
- [[grill-routes]] — forced senior-question grill gate handlers (open/ask/answer
  /verdict/evaluate/get/list).
- [[memory-routes]] — workspace memory create/list HTTP handlers.
- [[event-routes]] — workspace event replay and SSE stream handlers.
- [[rpc-endpoint]] — `POST /rpc` JSON-RPC framing over the in-process router.
- [[rpc-socket]] — `GET /rpc` JSON-RPC WebSocket framing over the same router.
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
