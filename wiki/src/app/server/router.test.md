---
type: module
path: '@root/src/app/server/router.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, server, http, auth]
aliases: [acp-router.test, router.test]
---

# ACP HTTP Router Tests

## Purpose

Provide the aggregate executable contract for [[acp-router]] session bootstrap,
actor attribution, scope enforcement, local-host fallback, workspace/work
lifecycle, review decisions, and hardened-auth mode.

## Interface

Vitest suite over an in-process web handler composed from `AppLive`,
`IdClockLive`, and optional `ACP_REQUIRE_AUTH` configuration.

## Algorithm

Initialize sessions from both the internal worker shape and spec capability
handshake, requiring canonical host capabilities, exact permission/workspace
echo, and rejecting protocol `0.2`. Include `review:collaborate` and
`review:respond` in separate bootstrap assertions so REST proves both additive
literals survive the public handshake. Reject a bootstrap containing both with
the exact mutual-exclusion issue and prove no session id is minted.
Use bearer scopes to attribute work creation, reject missing scope with 403, and
reject an unknown token with 401; without a token, require `worker_system` in
default local mode. Exercise workspace list/create/update/archive and the
post-archive 409, work create/claim plus conflict holder details and missing 404,
and review approve plus missing reject/changes/cancel behavior. Under
`ACP_REQUIRE_AUTH=true`, reject unauthenticated mutation while keeping session
bootstrap open and allowing the resulting scoped token.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT accept unsupported protocol versions during bootstrap.
- ❌ Do NOT collapse invalid credentials and insufficient scope into the same
  status: unknown token is 401, missing permission is 403.
- ❌ Do NOT use the system actor when a valid bearer identifies a worker.
- ❌ Do NOT permit mutation of an archived workspace or double-claim work.
- ❌ Do NOT close the session bootstrap route when hardened auth is enabled.
- ❌ Do NOT infer permission preservation from HTTP 200; assert the exact echoed
  array.
- ❌ Do NOT admit both response and collaboration scopes in one session.

## Grill Log

- **Q:** Why retain default unauthenticated mutation coverage? **A:** Local-host
  fallback is an explicit profile contract, not an accidental bypass; the same
  suite proves hardened mode reverses it. _Rejected:_ deleting fallback tests in
  favor of production-only auth assumptions.

## Referenced by

[[acp-router]] · [[route-support]] · [[id-clock]] · [[server/_MOC]] ·
[[Transport]] · [[src/_MOC]]
