---
type: moc
tags: [moc, src, app, server]
---

# Server Source MOC

Mirror of `@root/src/app/server/`. The HTTP transport entrypoint binding
[[acp-http-api]] to the domain services.

- [[server-index]] — opaque server barrel (router + id-clock).
- [[id-clock]] — id/timestamp minting primitive for the composition root.
- [[acp-router]] — `HttpRouter` wiring all v0.1 routes to services + SSE.
- [[server-main]] — Node `HttpServer` entrypoint on `ACP_PORT`.

## Referenced by

[[app/_MOC]] · [[src/_MOC]]
