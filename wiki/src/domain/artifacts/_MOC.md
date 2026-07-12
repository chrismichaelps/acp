---
type: moc
tags: [moc, src, domain, artifacts]
---

# Artifacts Source MOC

Artifact services coordinate durable [[Artifact]] metadata and optional
host-stored content for completed [[WorkUnit]] outputs.

## Modules

- [[artifact-service-index]] — opaque Artifact service barrel.
- [[artifact-service]] — Artifact metadata registry, content bounds, and events.
- [[artifact-service.test]] — content ownership, bounds, indexes, transitions,
  deletion, and events.

## Referenced by

[[domain/_MOC]] · [[src/_MOC]]
