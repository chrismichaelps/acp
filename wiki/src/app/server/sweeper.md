---
type: module
path: '@root/src/app/server/sweeper.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.6
depth_status: MEDIUM
tags: [module]
aliases: [sweeper, expiry-sweeper]
---

# Expiry Sweeper

## Purpose

The background **TTL eviction** daemon (spec §8 sessions, §11 leases). Periodically
evicts expired [[session.schema]] sessions and lapses overdue [[Lease]]s so the
in-memory host does not accumulate dead credentials or stale resource holds. Two
parts:

- `sweepOnce` — one deterministic sweep step (the unit of work and of test).
- `SweeperLive` — a `Layer` that forks `sweepOnce` on an interval as a daemon
  scoped to the host, so it lives exactly as long as the server and is interrupted
  when the host scope closes.

## Interface

### Signatures

```typescript
export interface SweepResult {
  readonly evictedSessions: readonly Session[]
  readonly expiredLeases: readonly Lease[]
}

// One sweep: read `now` from IdClock, evict stale sessions, expire due leases.
export const sweepOnce: Effect.Effect<
  SweepResult,
  StorageError,
  SessionService | LeaseService | AppConfigTag | IdClock
>

// Forks `sweepOnce` every `sweepInterval` as a scoped daemon.
export const SweeperLive: Layer.Layer<
  never,
  never,
  SessionService | LeaseService | AppConfigTag | IdClock
>
```

### Linkage

- **Requires:** [[session-service]] (`evictExpired`), [[lease-service]]
  (`expireAllDue`), [[app-config]] (`sessionTtl`, `sweepInterval`), [[id-clock]]
  (`now`).
- **Consumed by:** [[http-app]] — merged into the host layer over the shared
  `AppLive ⊕ IdClockLive` so the sweeper and the HTTP router act on the **same**
  in-memory store.

## Algorithm

`sweepOnce`:

1. `now ← IdClock.now`.
2. `evictedSessions ← SessionService.evictExpired(now, config.sessionTtl)`.
3. `expiredLeases ← LeaseService.expireAllDue(systemActor, now)` — lapses every
   due active lease across all workspaces, each emitting `lease.expired`.

`SweeperLive` (`Layer.scopedDiscard`): `forkScoped` a loop that sleeps
`config.sweepInterval`, runs `sweepOnce`, and swallows+logs any failure cause so a
single bad sweep never kills the daemon.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT provide a second `AppLive` to the sweeper — it must share the HTTP
  server's instance (see [[http-app]]); a separate provision is a separate store.
- ❌ Do NOT let a sweep failure terminate the loop — catch the cause and continue.
- ❌ Do NOT mint ids/timestamps here — `now` comes from [[id-clock]].
- ❌ Do NOT enumerate workspaces to find leases — [[lease-service]] `expireAllDue`
  scans all leases directly, so a lease in an unregistered workspace still lapses.

## Depth

MEDIUM (0.6). `sweepOnce` is unit-tested deterministically (seed an expired session
and a past-due lease, run one sweep, assert eviction + `expired` state + that a
fresh session survives). The interval fiber is thin glue — excluded from unit tests
like other composition-root wiring ([[server-main]]).

## Grill Log

- **Q:** Wall-clock `Effect.sleep` poll loop or per-entity scheduled expiry?
  **A:** A poll loop (`sleep sweepInterval` → `sweepOnce`). _Rationale:_ the store
  is in-memory and small; a single periodic scan is simpler and has no per-entity
  timer bookkeeping to leak. Expiry precision is bounded by `sweepInterval`
  (default 60s), which is fine for credential/lease hygiene. _Rejected:_ a timer
  wheel / per-lease scheduled fiber (needless complexity at v0.1 scale).
- **Q:** Where is the daemon forked?
  **A:** `forkScoped` inside `SweeperLive`, merged into [[http-app]] over the
  shared app runtime — so it lives exactly as long as the host and shares the one
  `Storage` instance. _Rationale:_ a separately-provided sweeper would operate on a
  _different_ in-memory store than the router and silently never see its sessions
  or leases. _Rejected:_ forking in [[server-main]] beside a second `AppLive`
  provision (the split-brain bug above).
- **Q:** Does lease expiry emit an event?
  **A:** Yes — reuses [[lease-service]]'s existing `lease.expired` emission through
  [[event-store]], so SSE subscribers observe lapses. Session eviction emits no
  event (sessions are host-local auth state, not a workspace coordination
  primitive). _Rejected:_ a new `session.expired` event type (no subscriber need).

## Referenced by

[[http-app]] · [[server-index]] · [[session-service]] · [[lease-service]]
· [[app-config]] · [[Transport]] · [[src/_MOC]]
