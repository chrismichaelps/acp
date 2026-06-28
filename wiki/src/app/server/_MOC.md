---
type: moc
tags: [moc, src, app, server]
---

# Server Source MOC

Mirror of `@root/src/app/server/`. The HTTP transport entrypoint binding
[[acp-http-api]] to the domain services.

- [[server-index]] — opaque server barrel (router + id-clock + http-app).
- [[id-clock]] — id/timestamp minting primitive for the composition root.
- [[acp-router]] — `HttpRouter` wiring all v0.1 routes to services + SSE + `/rpc`.
- [[route-support]] — shared authorization, response encoding, and route error folding.
- [[workspace-routes]] — workspace list/create/update HTTP handlers.
- [[rpc-endpoint]] — `POST /rpc` JSON-RPC framing over the in-process router.
- [[http-app]] — socket-agnostic host layer (router + sweeper over app + id-clock).
- [[sweeper]] — background TTL eviction daemon (stale sessions, due leases).
- [[server-main]] — Node `HttpServer` entrypoint on `ACP_PORT`.

## Referenced by

[[app/_MOC]] · [[src/_MOC]]
