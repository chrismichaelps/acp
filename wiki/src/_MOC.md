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

## domain/

- [[domain/_MOC|Domain services]] — transport-agnostic protocol behavior.
- [[events/_MOC|Events]] — persisted append-only event store and live fan-out.

## infrastructure/

- [[infrastructure/_MOC|Infrastructure]] — runtime adapters and platform edges.
- [[storage/_MOC|Storage]] — persistence seam interface, opaque barrel, and InMemory adapter.

_(apps added as their slices land)_

## Referenced by

[[00-INDEX]]
