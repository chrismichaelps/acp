---
type: moc
tags: [moc, src, domain]
---

# Domain Source MOC

Domain services coordinate protocol behavior while staying transport-agnostic.
They depend on seams such as [[Storage]], never on HTTP, JSON-RPC, or Node APIs.

## events/

- [[events/_MOC|Events MOC]] — append-only event persistence and live fan-out.

## Referenced by

[[src/_MOC]]
