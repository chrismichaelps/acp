---
type: moc
tags: [moc, src, app, cli]
---

# CLI Source MOC

Mirror of `@root/src/app/cli/`. The `acp` command-line client of [[acp-router]].

- [[cli-index]] — opaque CLI barrel (parser + client).
- [[cli-commands]] — pure `argv → CliRequest` parser (spec §21 commands).
- [[cli-command-support]] — shared request/error types and parser helpers.
- [[cli-event-commands]] — event replay and streaming command map.
- [[cli-memory-commands]] — workspace memory command map.
- [[cli-client]] — `HttpClient` sender against the local host.
- [[cli-main]] — Node entrypoint; prints JSON results.
- [[cli-usage]] — usage text printed for invalid local commands.

## Referenced by

[[app/_MOC]] · [[src/_MOC]]
