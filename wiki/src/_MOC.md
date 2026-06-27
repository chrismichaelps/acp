---
type: moc
tags: [moc, src]
---

# Source Mirror MOC

`wiki/src/` mirrors `@root/src/` depth-for-depth (1:1 Mirroring Law). Every source
file has exactly one page here. A source file with no page is UNREGISTERED.

## protocol/schema/

- [[ids]] — branded protocol identifiers (`WorkId`, `WorkerId`, …).
- [[common]] — shared enums/value objects (timestamps, priority, status literals).
- [[worker.schema]] · [[workspace.schema]] · [[work-unit.schema]] · [[lease.schema]]
  · [[artifact.schema]] · [[checkpoint.schema]] · [[review.schema]] · [[event.schema]]

## protocol/errors/

- [[protocol-error]] — tagged domain error families + protocol error code mapping.

## config/

- [[app-config]] — typed `ACP_*` configuration + Layer.

## app/

- [[app/_MOC|App]] — application Layer composition for entrypoints.

## domain/

- [[domain/_MOC|Domain services]] — transport-agnostic protocol behavior.
- [[artifacts/_MOC|Artifacts]] — Artifact metadata registry and content bounds.
- [[checkpoints/_MOC|Checkpoints]] — append-only resume points for WorkUnit handoff.
- [[events/_MOC|Events]] — persisted append-only event store and live fan-out.
- [[leases/_MOC|Leases]] — Lease lifecycle service and conflict guard.
- [[reviews/_MOC|Reviews]] — human-in-the-loop Review gates for WorkUnits.
- [[work-units/_MOC|Work Units]] — WorkUnit lifecycle service and state machine.
- [[workers/_MOC|Workers]] — Worker registry service (register, get, list, status).
- [[workspaces/_MOC|Workspaces]] — Workspace registry service with `workspace.*` events.

## infrastructure/

- [[infrastructure/_MOC|Infrastructure]] — runtime adapters and platform edges.
- [[storage/_MOC|Storage]] — persistence seam interface, opaque barrel, and InMemory/SQLite adapters.
- [[http/_MOC|HTTP]] — Effect Platform REST API declaration and error mapper.
- [[sse/_MOC|SSE]] — Server-Sent Events adapter for live event streams.

_(apps added as their slices land)_

## Referenced by

[[00-INDEX]]
