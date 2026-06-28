---
date: 2026-06-26
topic: scoped-auth-slice
from_role: Shadow
to_role: DNA Engineer
status: SLICE_COMPLETE
maturity: EXPLORING
tags: [handoff]
---

# Handoff — Scoped Auth Slice (spec §8 permission enforcement)

## Done

- Closed [[common]] `Permission` vocabulary — the 7 spec §8 scopes
  (`workspace:read`, `work:create`, `work:claim`, `lease:create`,
  `artifact:create`, `checkpoint:create`, `review:create`).
- `permissions: Permission[]` added to [[session.schema]] and the `initialize`
  payload (default `[]`); stored on the session at create.
- [[acp-router]] `resolveActor` → `authorize(scope?)`: resolves the bearer session
  via [[session-service]]`.get` and gates every mutation. No token → `worker_system`;
  token with no session, or a session lacking the required scope → `401 unauthorized`
  (`UnauthorizedError`, already mapped by [[http-error-mapper]]). Scoped routes pass
  their §8 scope; `PATCH state`/`events`/`release` call `authorize()` (attribute-only).
- Wiki: [[common]], [[session.schema]], [[session-service]] (2 new Grill entries),
  [[acp-router]], [[acp-http-api]] pages refreshed; CHANGELOG entry.
- Gate green: `tsc` · ESLint · Prettier (src) · **104 tests** (was 102; +2 router:
  scope-denied 401 and unknown-token 401; attribution test now declares its scope).

## Decided (do not re-litigate)

- **Scopes are a separate authorization set**, declared at `initialize`, not derived
  from §9 `capabilities` (which are mechanical, not permissions).
- **Only authenticated requests are scope-enforced.** No-token requests still degrade
  to `worker_system` (full access) so the local host is usable without a credential
  store. Mandatory auth is a reversible tightening for a hardened deployment.
- `session_id` remains the bearer token; still no expiry/rotation.
- `SessionService.resolveActor` is retained (token→actor) for non-HTTP transports,
  though the router now uses `get` for scope-aware checks.

## Open / Remaining (post-v0.1)

1. **Mandatory auth + credential issuance**: once the host can mint real tokens,
   flip unauthenticated mutations from `worker_system` to `401`.
2. **Session/lease expiry sweeper**: TTL eviction fiber.
3. **Live boot smoke test**: assert [[server-main]] binds `ACP_PORT` and serves
   `initialize` end-to-end.
4. **JSON-RPC transport** — **v0.2** per spec §7/§13 (Optional); HTTP+SSE is MVP.

## Exact next action

DNA Engineer: pick the **live boot smoke test** slice — author a wiki page for a
test that boots [[server-main]] on an ephemeral port and round-trips
`initialize` → scoped `createWork`, proving the composition root wires `AppLive`

- `IdClock` + router correctly. `grillme`: ephemeral-port bind vs. injected
  `HttpApp` web handler (no socket).

## Links

[[session-service]] · [[session.schema]] · [[common]] · [[acp-router]]
· [[http-error-mapper]] · [[protocol-error]] · [[ADR-0001-architecture-foundation]]
