---
type: moc
tags: [moc, src, infrastructure]
---

# Infrastructure MOC

Runtime adapters and platform edges. Infrastructure owns Effect `Layer`
construction and hides it behind narrow service tags.

## storage/

- [[storage/_MOC|Storage MOC]] — persistence seam interface and InMemory/SQLite adapters.

## http/

- [[http/_MOC|HTTP MOC]] — Effect Platform REST API declaration and error mapper.

## jsonrpc/

- [[jsonrpc/_MOC|JSON-RPC MOC]] — JSON-RPC 2.0 method normalization core.

## sse/

- [[sse/_MOC|SSE MOC]] — Server-Sent Events adapter for live event streams.

## Referenced by

[[src/_MOC]]
