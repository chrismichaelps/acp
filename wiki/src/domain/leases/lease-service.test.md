---
type: module
path: '@root/src/domain/leases/lease-service.test.ts'
fidelity: Active
domain: '[[Lease]]'
grammar: '[[grammar/typescript]]'
tags: [module, test, domain, lease, concurrency]
aliases: [lease-service.test]
---

# Lease Service Tests

## Purpose

Pin [[lease-service]] grant/conflict semantics, configured TTLs, lifecycle
transitions, due expiry, event ordering/data, missing-state errors, and workspace
isolation.

## Interface

Vitest suite over in-memory [[Storage]], [[event-store]], and explicit
`AppConfigTag` defaults.

## Algorithm

Grant and persist an active lease with requested/granted events. Race a second
holder on the same resource and require `LeaseConflictError`, requested/denied
events, and the current holder in event data. Use configured TTL when omitted.
Renew with an explicit TTL and require `lease.renewed`; release and revoke active
leases. Expire only due leases while preserving future claims and emitting
`lease.expired`. Return `NotFoundError` for release-missing,
`InvalidStateTransitionError` for renew-expired, and isolate workspace lists.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT grant two unexpired active claims for one resource.
- ❌ Do NOT hide the conflicting holder from error or denied-event evidence.
- ❌ Do NOT hardcode TTL when the request omits it.
- ❌ Do NOT renew an already expired lease.
- ❌ Do NOT expire future leases or mix workspaces in list results.

## Grill Log

- **Q:** Why emit requested even on denial? **A:** The audit log must record the
  attempted coordination action and its outcome without inventing persisted
  active state. _Rejected:_ denial-only evidence with no request context.

## Referenced by

[[lease-service]] · [[event-store]] · [[leases/_MOC]] · [[Lease]] ·
[[lease-resource-lock]] · [[src/_MOC]]
