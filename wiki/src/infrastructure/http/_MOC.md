---
type: moc
tags: [moc, src, infrastructure, http]
---

# HTTP Source MOC

Mirror of `@root/src/infrastructure/http/`.

- [[http-index]] — opaque public HTTP infrastructure exports.
- [[acp-http-api]] — Effect Platform `HttpApi` declaration for the v0.1 REST surface.
- [[acp-http-api-events]] — event replay and stream endpoint contract split from the central API declaration.
- [[acp-http-api-memory]] — workspace memory endpoint contract split from the central API declaration.
- [[acp-http-api-resume]] — work resume packet endpoint contract group.
- [[http-error-mapper]] — transport boundary mapper from tagged domain errors to JSON HTTP responses.

## Referenced by

[[infrastructure/_MOC]] · [[src/_MOC]]
