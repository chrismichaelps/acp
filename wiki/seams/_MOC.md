---
type: moc
tags: [moc, seam]
---

# Seams MOC

Registry of architectural boundaries with swappable adapters. Classification rule:
`Deepening_Effort ∝ Seam_Capacity`.

| Seam            | Capacity     | Lifecycle   | Drift     | Adapters (prod)          |
| --------------- | ------------ | ----------- | --------- | ------------------------ |
| [[Storage]]     | CRITICAL (6) | CRITICAL    | 0 HEALTHY | InMemory (SQLite future) |
| [[Transport]]   | CRITICAL (5) | EXPLORATORY | 0 HEALTHY | HTTP+SSE+JSON-RPC        |
| [[EventStream]] | CRITICAL (6) | CRITICAL    | 0 HEALTHY | SSE + WS notifications   |

## Referenced by

[[00-INDEX]] · [[architecture/_MOC]]
