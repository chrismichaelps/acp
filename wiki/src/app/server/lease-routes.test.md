---
type: module
path: '@root/src/app/server/lease-routes.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, server, lease]
aliases: [lease-routes.test]
---

# Lease Route Tests

## Purpose

Pin the inline [[acp-router]] lease transport contract for workspace listing,
request/release errors, renewal, revocation, and action-specific scopes.

## Interface

Vitest suite over the in-process router with scoped sessions and the real
[[lease-service]].

## Algorithm

Request an active file lease and list it with `workspace:read`. In local fallback
mode, request without a token and require releasing a missing lease to return 404. With dedicated scopes, renew the lease with an explicit TTL and then revoke
it. Reject renewal without `lease:renew` and authenticated listing without
`workspace:read`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT use `lease:create` as implicit authority to renew or revoke.
- ❌ Do NOT use lease mutation scope as authority to list workspace leases.
- ❌ Do NOT report success when releasing an unknown lease.
- ❌ Do NOT change an active lease to a non-active state during renewal.

## Grill Log

- **Q:** Why preserve unauthenticated request coverage? **A:** It pins the local
  profile's explicit system-actor fallback; scoped denial cases prove hardened
  bearer behavior separately. _Rejected:_ conflating local and required-auth
  policy in a route suite.

## Referenced by

[[acp-router]] · [[lease-service]] · [[server/_MOC]] · [[Transport]] ·
[[src/_MOC]]
