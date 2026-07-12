---
type: moc
tags: [moc, src, infrastructure, events]
---

# Infrastructure Events MOC

Concrete event fan-out adapters behind the domain [[EventBroker]] seam.

- [[events-index]] — opaque infrastructure event-adapter barrel.
- [[pg-notify-event-broker]] — Postgres LISTEN/NOTIFY broker for multi-replica
  live event fan-out.
- [[pg-notify-event-broker.test]] — live Postgres persisted-pointer fan-out
  contract.

## Referenced by

[[infrastructure/_MOC]] · [[src/_MOC]]
