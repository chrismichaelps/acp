---
type: module
path: '@root/src/infrastructure/storage/postgres-store.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
tags: [module, test, infrastructure, storage, postgres]
aliases: [postgres-store.test]
---

# Postgres Storage Tests

## Purpose

Prove [[postgres-store]] implements the [[storage]] contract against a real
database, including transactional sequencing, generated indexes, retention, and
version CAS.

## Interface

Database-gated Vitest integration suite; it runs only with
`ACP_TEST_DATABASE_URL` and truncates ACP tables before each case.

## Algorithm

Exercise keyed JSON CRUD, absence/value/version CAS, and missing `Option`.
Require per-workspace event sequences, cursor/limit replay, newest-watermark
retention, memory sequencing/filtering, conjunctive ordered `queryBy`, generated
column refresh after rewrite, post-order limit, and unknown-field rejection.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT dial the fallback URL when no test database is configured.
- ❌ Do NOT allocate event or memory sequences outside Postgres transactions.
- ❌ Do NOT reuse sequence numbers after pruning.
- ❌ Do NOT leave generated query columns stale after value replacement.
- ❌ Do NOT accept arbitrary query column names.

## Grill Log

- **Q:** Why retain a database-gated suite beside adapter-independent
  conformance? **A:** Transactional allocation, JSONB/generated columns, and SQL
  retention can only be certified by the real engine. _Rejected:_ treating
  SQLite parity as Postgres proof.

## Referenced by

[[postgres-store]] · [[storage]] · [[storage/_MOC]] · [[Storage]] · [[src/_MOC]]
