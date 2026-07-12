---
type: moc
tags: [moc, src, infrastructure, storage]
---

# Storage Source MOC

Mirror of `@root/src/infrastructure/storage/`.

- [[storage-index]] — opaque public storage exports.
- [[storage]] — `Storage` service tag and persistence port interface.
- [[in-memory-store]] — Ref-backed in-memory production adapter.
- [[in-memory-store.test]] — keyed, CAS, sequence, retention, and query contract.
- [[sqlite-store]] — file-backed SQLite production adapter.
- [[sqlite-store.test]] — full durable adapter, query-plan, tail, and retention contract.
- [[sqlite-store.query.test]] — focused indexed predicate query regressions.
- [[query-conformance.test]] — shared InMemory/SQLite query and version-CAS parity.
- [[sqlite-support]] — pure serialization + row-mapping helpers for the SQLite adapter.
- [[kv-statements]] — `kv` DDL + statement SQL derived from `INDEXED_FIELDS`.
- [[index-columns]] — promoted-column allowlist + extractor shared by all adapters.
- [[index-columns.test]] — complete/null-safe promoted-column extraction contract.
- [[postgres-store]] — network-durable Postgres production adapter.
- [[postgres-store.test]] — live transactional Postgres adapter contract.

## Referenced by

[[infrastructure/_MOC]] · [[src/_MOC]]
