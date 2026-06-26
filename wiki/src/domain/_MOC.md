---
type: moc
tags: [moc, src, domain]
---

# Domain Source MOC

Domain services coordinate protocol behavior while staying transport-agnostic.
They depend on seams such as [[Storage]], never on HTTP, JSON-RPC, or Node APIs.

## artifacts/

- [[artifacts/_MOC|Artifacts MOC]] — Artifact metadata registry and content bounds.

## checkpoints/

- [[checkpoints/_MOC|Checkpoints MOC]] — append-only resume points for WorkUnit handoff.

## events/

- [[events/_MOC|Events MOC]] — append-only event persistence and live fan-out.

## leases/

- [[leases/_MOC|Leases MOC]] — Lease lifecycle service and conflict guard.

## reviews/

- [[reviews/_MOC|Reviews MOC]] — human-in-the-loop Review gates for WorkUnits.

## work-units/

- [[work-units/_MOC|Work Units MOC]] — WorkUnit lifecycle service and state machine.

## workers/

- [[workers/_MOC|Workers MOC]] — Worker registry service (register, get, list, status).

## workspaces/

- [[workspaces/_MOC|Workspaces MOC]] — Workspace registry service with `workspace.*` events.

## Referenced by

[[src/_MOC]]
