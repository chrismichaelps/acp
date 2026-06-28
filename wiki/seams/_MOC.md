---
type: moc
tags: [moc, seam]
---

# Seams MOC

Registry of architectural boundaries with swappable adapters. Classification rule:
`Deepening_Effort ∝ Seam_Capacity`.

| Seam            | Capacity        | Lifecycle   | Drift     | Adapters (prod)             |
| --------------- | --------------- | ----------- | --------- | --------------------------- |
| [[Storage]]     | CRITICAL (6)    | CRITICAL    | 0 HEALTHY | InMemory (SQLite future)    |
| [[Transport]]   | CRITICAL (5)    | EXPLORATORY | 0 HEALTHY | HTTP+SSE (JSON-RPC v0.2)    |
| [[EventStream]] | EXPLORATORY (3) | EXPLORATORY | 0 HEALTHY | SSE (WebSocket speculative) |

## Referenced by

[[00-INDEX]] · [[architecture/_MOC]]
