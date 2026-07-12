---
type: moc
tags: [moc, src, domain, checkpoints]
---

# Checkpoints Source MOC

Checkpoint services coordinate append-only [[Checkpoint]] resume points for
[[WorkUnit]] handoff and recovery.

## Modules

- [[checkpoint-service-index]] — opaque Checkpoint service barrel.
- [[checkpoint-service]] — append-only Checkpoint registry and latest resume point.
- [[checkpoint-service.test]] — persistence, indexes, ordering, latest, and absence.

## Referenced by

[[domain/_MOC]] · [[src/_MOC]]
