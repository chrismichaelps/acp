---
type: domain
tags: [domain]
aliases: [Lease, lease]
---

# Lease

- **Definition:** A temporary, expiring claim by a [[Worker]] over a resource,
  scoped to a [[Workspace]] and usually a [[WorkUnit]]. Prevents two workers from
  conflicting on the same resource.
- **Canonical name:** Lease. Never "lock" (a lock implies permanence; a lease expires),
  never "reservation".
- **Not:** ownership — a lease is advisory coordination state, not a mandatory
  filesystem or scheduler lock, and is always bounded by `expires_at`.
- **States:** `active · expired · released · revoked`.
- **Resource kinds:** `file · directory · branch · worktree · task · service ·
database_migration · custom`.
- **TTL:** every lease carries a `Duration` TTL loaded from `ACP_DEFAULT_LEASE_TTL`
  unless overridden per request.
- **Conflict:** requesting a lease on an actively-leased resource held by another
  worker ⇒ `LeaseConflictError` ⇒ HTTP `409` (`lease_conflict`).
- **Example:** `lease_123` on `file://src/auth/callback.ts`, held by `agent_claude_code`,
  expires in 15 min.

## Referenced by

(maintained by Forensic Guardian)
