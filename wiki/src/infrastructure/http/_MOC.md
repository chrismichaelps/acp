---
type: moc
tags: [moc, src, infrastructure, http]
---

# HTTP Source MOC

Mirror of `@root/src/infrastructure/http/`.

- [[http-index]] — opaque public HTTP infrastructure exports.
- [[acp-http-api]] — Effect Platform REST declaration plus exact effective
  permission/workspace session handshake echo and dual-role rejection.
- [[acp-http-api.test]] — session projection/mutual-exclusion, capability, event
  vocabulary, and full reflected REST inventory contract.
- [[acp-http-api-events]] — event replay and stream endpoint contract split from the central API declaration.
- [[acp-http-api-memory]] — workspace memory endpoint contract split from the central API declaration.
- [[acp-http-api-resume]] — work resume packet endpoint contract group.
- [[http-error-mapper]] — transport boundary mapper from tagged domain errors to JSON HTTP responses.
- [[http-error-mapper.test]] — HTTP status and storage-cause no-leak contract.
- [[openapi-module]] — deterministic OpenAPI projection, router-auth security
  repair, protocol identity, and canonical serialization.
- [[openapi-module.test]] — semantic security plus byte-for-byte artifact drift
  gate.

## Referenced by

[[infrastructure/_MOC]] · [[src/_MOC]]
