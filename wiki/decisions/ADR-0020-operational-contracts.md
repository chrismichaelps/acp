---
type: decision
status: ACCEPTED
date: 2026-07-15
tags: [adr, accepted, operations, retention, upgrade, backup]
aliases: [ADR-0020, operational-contracts]
---

# ADR-0020 — Operational Contracts: Retention, Upgrade, Backup

## Status

ACCEPTED for issue #331.

## Context

ACP's event log and `kv` store grow without bound unless an operator prunes
them, and the store has no boot-time check that a build actually understands
the protocol version stamped into it. Neither gap is instrumentation — both
are missing operational guarantees. Operators running ACP over time need three
things to hold exactly as stated, not as implementation detail that can drift:
what happens to old events, what happens when a store meets a build from a
different protocol version, and how to get a consistent copy of the store out
and back in. [[operational-contracts]] is the reference surface for these
guarantees; this ADR is the decision record behind it.

## Decision

### Delete-based retention, stable-seq replay

Retention is delete-based pruning, not compaction. The background sweeper
calls `pruneBefore(now - ACP_EVENT_RETENTION_DAYS)` on a schedule, permanently
deleting events older than the retention window; `ACP_EVENT_RETENTION_DAYS <= 0`
disables pruning. There is no fold-into-summary step — a pruned row is simply
gone. Event `seq` is monotonic and stable: once assigned it never changes, the
store persists a high-water mark across restarts, and `readEventsAfter(afterSeq)`
is the only cursor into the log, walking strictly in `seq` order over whatever
is currently retained. A cursor older than the prune horizon does not error; it
resumes at the oldest retained event, silently skipping what was pruned.
Appends keep advancing `seq` across a prune — pruning never resets or reuses
sequence numbers.

### Version guard reuses `kv`, fails closed

The compatibility guard reuses the existing `kv` table rather than introducing
a dedicated metadata table. It stamps a reserved collection/id pair,
`store_meta`/`protocol_version`, with `ACP_PROTOCOL_VERSION` once, at creation,
on a fresh store. On every boot, the guard reads that stamp and checks it
against `SUPPORTED_PROTOCOL_VERSIONS`. If the stamp is outside that set, the
process fails closed and refuses to start. There is no automatic cross-version
data migration — moving a store to a new protocol version requires an explicit
migration path or a fresh store; the guard exists precisely to stop an
unmigrated store from running silently under a newer build.

### Backup/restore is a documented, tested runbook

Backup and restore is operational procedure, not new product surface. SQLite
stores are backed up with the SQLite backup API (or `.backup`), never a raw
filesystem copy of a live database file, which can tear mid-write. Postgres
stores are backed up with `pg_dump`, which takes an online-consistent snapshot
safely against a live store. Both paths are documented and exercised by tests;
a restore returns the store to a consistent point — it does not replay
anything pruned before that point and does not migrate the protocol stamp.

## Rationale

Delete-based pruning with a stable `seq` cursor gives operators a retention
window whose behavior is exact and easy to reason about: nothing pruned is
ever replayed, and nothing else about the log's ordering changes. Compaction
was avoided because it would trade a simple, auditable guarantee (rows exist
or they don't) for a second data shape consumers would need to understand.

Reusing `kv` for the version stamp avoids a third bespoke table across three
storage adapters for a single row of metadata; `kv` already has identical
semantics everywhere Storage is implemented. Failing closed on an unsupported
stamp is the only safe default when no cross-version transform exists yet —
proceeding anyway risks silently corrupting or misreading a store built for
a different protocol shape.

Treating backup/restore as a runbook rather than a feature keeps the
guarantee where operators actually need it: proven procedure using each
backend's own consistent-snapshot primitive, not a new ACP-specific format
that would itself need versioning and migration.

## Consequences

- Operators get a bounded event log with a retention window they control via
  `ACP_EVENT_RETENTION_DAYS`, and can reason precisely about what a resumed
  cursor will and will not see.
- A store's protocol stamp is set once and never silently reinterpreted; any
  future protocol change that is incompatible with existing stores must ship
  an explicit migration or require a fresh store, not rely on the guard to
  paper over the gap.
- `kv`'s `store_meta` collection becomes a reserved namespace: application
  code must not use it for other purposes, since the boot guard treats it as
  authoritative version state.
- Backup/restore correctness depends on operators using the documented
  per-backend primitive; a raw file copy of a live SQLite database is
  explicitly unsupported and can produce a torn, unusable backup.

## Alternatives

**Compact pruned events into a summary record** — rejected because it
introduces a second data shape (summary vs. raw event) that every consumer of
the event log would need to understand, for a benefit (partial history after
pruning) operators did not ask for.

**Add a dedicated `meta`/`store_info` table for the protocol stamp** —
rejected because it means three new DDL paths (SQLite, Postgres, in-memory)
and migration ordering for a single row, when `kv` already provides identical
semantics across all three adapters.

**Best-effort auto-migration across protocol versions** — rejected because
0.x has exactly one supported version and no cross-version transform exists
to auto-apply; attempting one without a defined transform risks corrupting
the store silently instead of refusing to start.

**Ship an ACP-specific backup format/tool** — rejected because SQLite and
Postgres already provide safe, consistent-snapshot primitives; a bespoke
format would duplicate that work and need its own versioning story.

## Validation

Acceptance requires tests proving: pruned events are never returned by
`readEventsAfter`, a cursor older than the prune horizon resumes at the oldest
retained event without erroring, `seq` never resets or repeats across a prune,
the boot guard fails closed against a stamp outside `SUPPORTED_PROTOCOL_VERSIONS`,
a fresh store is stamped with `ACP_PROTOCOL_VERSION` on first boot, and the
documented SQLite backup-API and Postgres `pg_dump` runbooks actually restore
a consistent, usable store; plus the [[operational-contracts]] reference and
the full typecheck/lint/format/suite gate.

## Grill Log

- **Q:** Why reuse `kv` instead of a dedicated `meta` table? **A:** `kv` exists
  in all three adapters with identical semantics; a new table means three new
  DDL paths and migration ordering for one row. _Rejected:_ a bespoke `meta`
  table.
- **Q:** Should the guard attempt to migrate an older-but-unsupported store
  forward? **A:** No; 0.x has one supported version and no cross-version
  transform exists, so silently proceeding would risk corruption. Fail closed
  and name the versions. _Rejected:_ best-effort auto-migration.
