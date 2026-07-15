---
type: moc
tags: [moc, src, domain, sessions]
---

# Sessions Source MOC

Mirror of `@root/src/domain/sessions/`.

- [[session-service-index]] — opaque public Session service exports.
- [[session-service]] — Session registry: create, get, and bearer-token actor
  resolution.
- [[session-service.test]] — persistence, workspace bindings, and actor lookup.
- [[session-issuer]] — transport-neutral trusted/static issue and revocation port.
- [[session-issuer.test]] — trusted-client compatibility contract.

## Referenced by

[[domain/_MOC]] · [[src/_MOC]]
