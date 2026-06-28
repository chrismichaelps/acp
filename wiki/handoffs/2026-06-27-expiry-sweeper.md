---
date: 2026-06-27
topic: expiry-sweeper-slice
from_role: Shadow
to_role: DNA Engineer
status: SLICE_COMPLETE
maturity: EXPLORING
tags: [handoff]
---

# Handoff — Expiry Sweeper Slice (session/lease TTL eviction daemon)

## Done

- New [[sweeper]] (`src/app/server/sweeper.ts`): `sweepOnce` (deterministic single
  sweep) + `SweeperLive` (`Layer.scopedDiscard` that `forkScoped`s the loop on
  `config.sweepInterval`, swallowing+logging any failed tick).
- [[session-service]] gained `list()` and `evictExpired(now, ttl)` (removes
  sessions where `created_at + ttl ≤ now`, returns them; no event).
- [[lease-service]] gained `expireAllDue(actor, now)` — lapses due active leases
  across **all** workspaces (scans the full lease collection), each emitting
  `lease.expired`. Shares an extracted `expireEach` helper with `expireDue`.
- [[app-config]] gained `sessionTtl` (`ACP_SESSION_TTL`, default 1h) and
  `sweepInterval` (`ACP_SWEEP_INTERVAL`, default 60s).
- [[http-app]] now merges `SweeperLive` beside `HttpServer.serve(acpRouter)` over
  one memoized `AppLive ⊕ IdClockLive`, so the router and sweeper share one
  `Storage`. [[server-index]] re-exports the sweeper. `main.ts` unchanged.
- Wiki: new [[sweeper]] page (3 Grill entries); [[session-service]],
  [[lease-service]], [[app-config]], [[http-app]], server `_MOC` refreshed; CHANGELOG.
- Gate green: `tsc` · ESLint · Prettier (src) · **107 tests** (was 105; +2 sweeper:
  evict-stale/lapse-due sparing fresh, and empty-store no-op; +2 existing test
  `AppConfig` literals extended with the new fields).

## Decided (do not re-litigate)

- **Poll loop, not per-entity timers.** A single periodic scan over the in-memory
  store; expiry precision is bounded by `sweepInterval` (fine for v0.1).
- **Forked in the host scope** via `SweeperLive` merged into [[http-app]] — a
  second `AppLive` provided in `main.ts` would give the sweeper a _different_
  in-memory store than the router (split-brain). The merge shares one memoized app.
- **Test the step, not the fiber.** `sweepOnce` is unit-tested deterministically;
  the interval fiber is thin composition-root glue, excluded like [[server-main]].
- **Lease lapse reuses `lease.expired`; session eviction emits no event** (sessions
  are host-local auth state, not a workspace coordination primitive).

## Open / Remaining (post-v0.1)

1. **Mandatory auth + credential issuance**: once the host can mint real tokens,
   flip unauthenticated mutations from `worker_system` to `401`.
2. **JSON-RPC transport** — **v0.2** per spec §7/§13 (Optional); HTTP+SSE is MVP.

## Exact next action

DNA Engineer: pick the **mandatory-auth** slice (the last post-v0.1 item before a
v0.2 boundary). Author a wiki page for a host credential mode: an `ACP_REQUIRE_AUTH`
config flag that, when set, makes [[acp-router]]'s `authorize` reject _unauthenticated_
mutations with `401` instead of degrading to `worker_system` (the reversible
tightening already noted in [[session-service#Grill Log]] and [[acp-router#Grill Log]]).
`grillme`: whether `initialize` itself stays open (it must, to mint the first
session) and how the flag threads into `authorize` (config-injected vs. a router
parameter).

## Links

[[sweeper]] · [[session-service]] · [[lease-service]] · [[app-config]]
· [[http-app]] · [[acp-router]] · [[event-store]] · [[ADR-0001-architecture-foundation]]
