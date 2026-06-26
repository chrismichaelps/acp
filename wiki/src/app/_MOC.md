---
type: moc
tags: [moc, src, app]
---

# App Source MOC

Application modules compose runtime Layers for server and CLI entrypoints.

## Modules

- [[app-live-index]] — opaque app layer barrel.
- [[app-live]] — in-memory application Layer composition.

## server/

- [[server/_MOC|Server MOC]] — HTTP transport entrypoint (router, id-clock, Node main).

## cli/

- [[cli/_MOC|CLI MOC]] — `acp` command-line client (parser, client, Node main).

## Referenced by

[[src/_MOC]]
