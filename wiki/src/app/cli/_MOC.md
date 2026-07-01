---
type: moc
tags: [moc, src, app, cli]
---

# CLI Source MOC

Mirror of `@root/src/app/cli/`. The `acp` command-line client of [[acp-router]].

- [[cli-index]] — opaque CLI barrel (parser + client).
- [[cli-commands]] — pure `argv → CliRequest` parser (spec §21 commands).
- [[cli-session-commands]] — bearer-session bootstrap command map.
- [[session-commands-test]] — parser regression for `session init`.
- [[session-auth-flow-test]] — require-auth CLI bootstrap plus bearer forwarding
  flow.
- [[artifact-pr-command-test]] — focused parser regression for PR artifact URLs.
- [[cli-command-support]] — shared request/error types and parser helpers.
- [[cli-event-commands]] — event replay and streaming command map.
- [[cli-lease-commands]] — lease lifecycle and readback command map.
- [[cli-memory-commands]] — workspace memory command map.
- [[cli-client]] — `HttpClient` sender against the local host.
- [[cli-main]] — Node entrypoint; prints JSON results.
- [[cli-usage]] — usage text printed for invalid local commands.

## Referenced by

[[app/_MOC]] · [[src/_MOC]]
