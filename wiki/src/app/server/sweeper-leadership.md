---
type: module
path: '@root/src/app/server/sweeper-leadership.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.5
depth_status: MEDIUM
tags: [module]
aliases: [sweeper-leadership, sweeper-leader-election]
---

# Sweeper Leadership

## Purpose

`SweeperLeadership` is the single-writer guard around background sweeper ticks.
Local and single-node hosts use [[InProcessSweeperLeadershipLive]], which always
runs the sweep. Postgres-backed hosts use
[[makePostgresSweeperLeadershipLive]], which takes a Postgres advisory
transaction lock before the sweep mutates sessions, leases, or event retention.

The guard keeps multi-replica hosts from emitting duplicate `lease.expired`
events when every replica runs the same background daemon.

## Interface

```typescript
export interface SweeperLeadershipApi {
  readonly run: <A, E, R>(
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<Option.Option<A>, E | StorageError, R>
}
```

`Option.some(result)` means this replica held leadership and ran the sweep.
`Option.none()` means another replica held the lock, so the caller should skip the
tick without treating it as a failure.

## Algorithm

`SweeperLeadershipLive` reads [[app-config]]. When
`ACP_STORAGE_ADAPTER=postgres`, it requires `ACP_DATABASE_URL` and builds the
Postgres adapter. Otherwise it returns the in-process adapter.

The Postgres adapter runs each guarded effect inside `sql.withTransaction`, first
executing `pg_try_advisory_xact_lock(namespace, key)`. PostgreSQL releases the
lock automatically when the transaction ends, including failed sweeps, so the host
does not need a manual unlock path.

## Negative Logic

- Do not guard local memory or SQLite hosts with Postgres; they are single-process
  deployment shapes.
- Do not use the lock as data consistency. Storage operations remain responsible
  for their own atomic writes; the advisory lock only suppresses duplicate
  sweeper side effects across replicas.
- Do not fail a tick when the lock is already held. Skipping is expected in a
  replicated deployment.

## Referenced by

[[sweeper-leadership.test]] · [[sweeper.test]] · [[sweeper]] · [[http-app]] ·
[[app-config]] · [[server-index]]
