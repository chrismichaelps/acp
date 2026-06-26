---
type: moc
tags: [moc, src, domain, leases]
---

# Leases Source MOC

Lease services coordinate temporary resource claims for [[Worker]]s inside a
[[Workspace]] and keep the append-only [[Event]] log aligned with state changes.

## Modules

- [[lease-service-index]] — opaque Lease service barrel.
- [[lease-service]] — Lease lifecycle service, conflict guard, renewal, release,
  revoke, and expiry sweep.

## Referenced by

[[domain/_MOC]] · [[src/_MOC]]
