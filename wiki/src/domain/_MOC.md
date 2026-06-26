---
type: moc
tags: [moc, src, domain]
---

# Domain Source MOC

Domain services coordinate protocol behavior while staying transport-agnostic.
They depend on seams such as [[Storage]], never on HTTP, JSON-RPC, or Node APIs.

## events/

- [[events/_MOC|Events MOC]] — append-only event persistence and live fan-out.

## leases/

- [[leases/_MOC|Leases MOC]] — Lease lifecycle service and conflict guard.

## work-units/

- [[work-units/_MOC|Work Units MOC]] — WorkUnit lifecycle service and state machine.

## workers/

- [[workers/_MOC|Workers MOC]] — Worker registry service (register, get, list, status).

## workspaces/

- [[workspaces/_MOC|Workspaces MOC]] — Workspace registry service with `workspace.*` events.

## Referenced by

[[src/_MOC]]
