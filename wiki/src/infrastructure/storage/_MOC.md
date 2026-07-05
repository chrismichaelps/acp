---
type: moc
tags: [moc, src, infrastructure, storage]
---

# Storage Source MOC

Mirror of `@root/src/infrastructure/storage/`.

- [[storage-index]] — opaque public storage exports.
- [[storage]] — `Storage` service tag and persistence port interface.
- [[in-memory-store]] — Ref-backed in-memory production adapter.
- [[sqlite-store]] — file-backed SQLite production adapter.
- [[sqlite-support]] — pure serialization + row-mapping helpers for the SQLite adapter.
- [[postgres-store]] — network-durable Postgres production adapter.

## Referenced by

[[infrastructure/_MOC]] · [[src/_MOC]]
