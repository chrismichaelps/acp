---
type: reference
tags: [reference, operations, retention, backup, upgrade]
aliases: [operational-contracts, retention, backup, upgrades]
---

# Operational contracts

ACP's operators need three guarantees to run the store safely over time:
what happens to old events, what happens across a protocol upgrade, and how
to get a consistent copy out and back in. These are contracts, not
implementation details — alerting, runbooks, and upgrade tooling depend on
them holding exactly as stated below.

## Event retention & replay

Retention is delete-based. The background sweeper
(`src/app/server/sweeper.ts`) calls `pruneBefore(now - ACP_EVENT_RETENTION_DAYS)`
on a schedule, permanently deleting events older than the retention window.
**There is no compaction** — pruning removes rows outright; it does not fold
them into a summary or checkpoint. Setting `ACP_EVENT_RETENTION_DAYS <= 0`
disables pruning entirely.

Event `seq` is monotonic and stable: once assigned, a `seq` never changes,
and the store persists a high-water mark so numbering survives restarts.
`readEventsAfter(afterSeq)` is the only cursor into the event log, and it
walks strictly in `seq` order over whatever is currently retained. Two
consequences follow directly:

- Pruned events are permanently gone and are never replayed to any consumer.
- A cursor older than the prune horizon does not error — it resumes at the
  oldest retained event, silently skipping whatever was pruned in between.

The cutoff is exclusive: an event whose timestamp exactly equals the cutoff
is retained, and a workspace's newest event (its `seq` high-water mark) is
never pruned even when it is older than the cutoff — so numbering survives a
full-history sweep. New appends keep advancing `seq` across a prune; pruning
never resets or reuses sequence numbers.

## Upgrades

The store stamps its protocol version once, at creation, in
`store_meta/protocol_version` (the `kv` table). On every boot, a
compatibility guard checks that stamp: if it isn't in
`SUPPORTED_PROTOCOL_VERSIONS`, the process fails closed and refuses to
start. There is **no automatic cross-version data migration** — moving a
store to a new protocol version requires an explicit migration path or a
fresh store; the boot guard exists precisely to stop an unmigrated store
from running silently under a newer build.

## Backup & restore

- **SQLite** — use the SQLite backup API or the `.backup` command. A raw
  filesystem copy of the database file can tear if writes are in flight;
  the backup API is the only safe path for a live store.
- **Postgres** — use `pg_dump` (and its matching restore). `pg_dump` takes
  an online-consistent snapshot, so it is safe to run against a live store
  without pausing writers.

A restore returns the store to a consistent point; it does not replay
anything pruned before that point (see above) and does not migrate the
protocol stamp.

## Referenced by

[[00-INDEX]] · [[metrics]] · [[ADR-0020-operational-contracts]]
