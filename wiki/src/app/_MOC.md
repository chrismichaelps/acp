---
type: moc
tags: [moc, src, app]
---

# App Source MOC

Application modules compose runtime Layers for server and CLI entrypoints.

## Modules

- [[app-live-index]] — opaque app layer barrel.
- [[app-live]] — application Layer composition.
- [[app-live.test]] — composition, SQLite persistence, and broker prerequisite
  regression coverage.
- [[event-broker-live]] — config-driven EventBroker adapter selection.
- [[app-logging]] — Effect JSON logger setup and ACP log-level translation.
- [[logging.test]] — ACP-to-Effect level mapping and config-default coverage.
- [[storage-live]] — config-driven Storage adapter selection.

## server/

- [[server/_MOC|Server MOC]] — HTTP transport entrypoint (router, id-clock, Node main).

## cli/

- [[cli/_MOC|CLI MOC]] — `acp` command-line client (parser, client, Node main).

## stdio/

- [[stdio/_MOC|Stdio MOC]] — JSON-RPC stdio bridge over `POST /rpc`.

## Referenced by

[[src/_MOC]]
