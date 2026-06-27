---
date: 2026-06-26
topic: session-auth-slice
from_role: Shadow
to_role: DNA Engineer
status: SLICE_COMPLETE
maturity: EXPLORING
tags: [handoff]
---

# Handoff — Session Auth Slice (first post-v0.1)

## Done
- [[session.schema]] (`{ id, worker_id, created_at }`) + [[session-service]]
  (`create`, `get`, total `resolveActor`) backed by [[Storage]], mirroring the
  [[worker-service]] encode-on-write/decode-on-read pattern. Wired into [[app-live]].
- [[acp-router]] `initializeSession` now mints a session via [[id-clock]] and
  returns the spec §9 shape — `session_id` (the v0.1 bearer token),
  `protocol_version`, `host`, host `capabilities` — **replacing** the old
  worker-echo response. All mutating handlers resolve the actor from
  `Authorization: Bearer <session_id>`, falling back to `worker_system` when absent.
- Wiki: sessions MOC + index + service page, [[session.schema]] page, domain MOC
  link, router/api pages refreshed, CHANGELOG entry.
- Gate green: `tsc` · ESLint · Prettier (src) · **102 tests** (was 97; +3
  SessionService, +2 router for bearer attribution and system fallback).

## Decided (do not re-litigate)
- **`session_id` IS the bearer token** in v0.1 — no separate `hdf_xxx` secret. A
  hardened auth slice owns rotation/hashing. See [[session-service#Grill Log]].
- **No expiry / no scopes** this slice. `resolveActor` returns `Option`, never a
  `401`; the router (not the registry) owns auth policy and degrades to
  `worker_system` when unauthenticated.
- **`InitializeSessionResponse` changed shape** (worker-echo → §9 host handshake).
  The router test was updated accordingly.

## Open / Remaining (post-v0.1)
1. **Scoped auth + `401`**: enforce spec §8 permission scopes; reject mutations
   that need auth with `unauthorized` instead of silently using `worker_system`.
2. **Session expiry / sweeper**: TTL eviction fiber (pairs with the lease-expiry
   sweeper).
3. **Live boot smoke test**: assert [[server-main]] actually binds `ACP_PORT` and
   serves `initialize`.
4. **JSON-RPC transport** — explicitly **v0.2** per spec §7/§13 (methods are
   "Optional"); HTTP+SSE is the recommended MVP transport. Not needed for v0.1.

## Exact next action
DNA Engineer: pick the scoped-auth slice — author a wiki page for a permission
check that reads the session's worker capabilities/scopes and gates each mutation,
returning the §15 `unauthorized` protocol error. `grillme`: where scopes live
(on the [[Worker]] capabilities vs. a separate session-scope set).

## Links
[[session-service]] · [[session.schema]] · [[acp-router]] · [[id-clock]]
· [[app-live]] · [[worker-service]] · [[ADR-0001-architecture-foundation]]
