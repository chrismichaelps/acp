---
type: moc
tags: [moc, src, domain, events]
---

# Events Source MOC

Mirror of `@root/src/domain/events/`.

- [[event-store-index]] — opaque public events service exports.
- [[event-broker]] — live event fan-out seam and in-process adapter.
- [[event-broker.test]] — firehose delivery and multi-subscriber fan-out.
- [[event-store]] — persisted append + broker-backed live fan-out service.
- [[event-store.test]] — sequencing, replay, empty history, and workspace filtering.

## Referenced by

[[domain/_MOC]] · [[src/_MOC]]
