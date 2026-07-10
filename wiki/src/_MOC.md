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
  · [[artifact.schema]] · [[checkpoint.schema]] · [[review.schema]] ·
  [[resume-schema]] · [[event.schema]]

## protocol/

- [[protocol-version]] — canonical ACP version constant, supported-version schema,
  and handshake compatibility predicate.

## protocol/errors/

- [[protocol-error]] — tagged domain error families + protocol error code mapping.

## config/

- [[config/_MOC|Config]] — typed runtime configuration registry.
- [[app-config]] · [[app-config.test]] — typed `ACP_*` Layer and its executable
  defaults/profile contract.

## app/

- [[app/_MOC|App]] — application Layer composition for entrypoints.
- [[stdio/_MOC|Stdio]] — JSON-RPC Content-Length bridge to the local ACP host.

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
- [[storage/_MOC|Storage]] — persistence seam interface, opaque barrel, and
  InMemory/SQLite/Postgres adapters.
- [[http/_MOC|HTTP]] — Effect Platform REST API declaration and error mapper.
- [[jsonrpc/_MOC|JSON-RPC]] — JSON-RPC 2.0 method normalization core.
- [[sse/_MOC|SSE]] — Server-Sent Events adapter for live event streams.
- [[platform-node/_MOC|Platform Node]] — Node-specific runtime Layers.

_(apps added as their slices land)_

## Referenced by

[[00-INDEX]]
