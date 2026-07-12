---
type: moc
tags: [moc, src, domain, memory]
---

# Memory Source MOC

Memory services coordinate append-oriented [[Memory]] records for workspace
handoff and recall.

## Modules

- [[memory-service-index]] — opaque Memory service barrel.
- [[memory-service]] — Memory creation, cursor reads, and event emission.
- [[memory-service.test]] — sequence assignment, creation event, and filtered read.

## Referenced by

[[domain/_MOC]] · [[src/_MOC]]
