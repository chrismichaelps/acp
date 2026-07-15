---
type: moc
tags: [moc, seam]
---

# Seams MOC

Registry of architectural boundaries with swappable adapters. Classification rule:
`Deepening_Effort ∝ Seam_Capacity`.

| Seam                | Capacity        | Lifecycle   | Drift     | Adapters (prod)                  |
| ------------------- | --------------- | ----------- | --------- | -------------------------------- |
| [[Storage]]         | CRITICAL (6)    | CRITICAL    | 0 HEALTHY | InMemory + SQLite + Postgres     |
| [[Transport]]       | CRITICAL (5)    | EXPLORATORY | 0 HEALTHY | HTTP+SSE+JSON-RPC                |
| [[EventStream]]     | CRITICAL (6)    | CRITICAL    | 0 HEALTHY | SSE + WS notifications           |
| [[GitHub]]          | EXPLORATORY (2) | EXPLORATORY | 0 HEALTHY | gh CLI                           |
| [[SessionIssuance]] | CRITICAL (5)    | CRITICAL    | 0 HEALTHY | Trusted client + Static identity |

## Referenced by

[[00-INDEX]] · [[architecture/_MOC]]
