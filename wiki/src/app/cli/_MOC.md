---
type: moc
tags: [moc, src, app, cli]
---

# CLI Source MOC

Mirror of `@root/src/app/cli/`. The `acp` command-line client of [[acp-router]].

- [[cli-index]] — opaque CLI barrel (parser + client).
- [[cli-commands]] — pure `argv → CliRequest` parser (spec §21 commands).
- [[commands.test]] — broad core-family argv-to-request contract.
- [[command-registry.test]] — duplicate registration and longest-prefix parser
  guardrails.
- [[cli-session-commands]] — bearer-session bootstrap command map.
- [[session-commands-test]] — parser regression for `session init`.
- [[session-auth-flow-test]] — require-auth CLI bootstrap plus bearer forwarding
  flow.
- [[artifact-pr-command-test]] — focused parser regression for PR artifact URLs.
- [[cli-artifact-commands]] — artifact lifecycle and PR artifact command map.
- [[cli-checkpoint-commands]] — checkpoint create/list/latest command map.
- [[cli-command-support]] — shared request/error types and parser helpers.
- [[cli-event-commands]] — event replay and streaming command map.
- [[event-commands.test]] — replay cursor, limit, type-filter, and streaming
  parsing coverage.
- [[cli-lease-commands]] — lease lifecycle and readback command map.
- [[lease-commands.test]] — resource, TTL, list-filter, and lifecycle parsing.
- [[cli-memory-commands]] — workspace memory command map.
- [[cli-review-commands]] — review workflow command map.
- [[cli-review-comment-commands]] — diff-anchored review comment command map.
- [[cli-grill-commands]] — forced senior-question grill gate command map.
- [[review-commands-test]] — focused parser regression for signed review
  approval evidence.
- [[cli-work-commands]] — work lifecycle command map.
- [[work-commands.test]] — list-filter and compact resume parsing coverage.
- [[cli-worker-commands]] — worker registry command map.
- [[cli-workspace-commands]] — workspace lifecycle command map.
- [[cli-client]] — `HttpClient` sender against the local host.
- [[client.test]] — method/auth construction and client-filter behavior.
- [[cli-dogfood-support]] — live multi-agent CLI harness and gate fixtures.
- [[gh-bridge]] — `acp gh import|sync|merge` bridge binding the review gate to GitHub PRs.
- [[gh-bridge-support]] — typed ACP GET/POST helpers for the GitHub bridge.
- [[gh-reconcile]] — pure comment reconciliation and merge-gate rules.
- [[cli-main]] — Node entrypoint; prints JSON results.
- [[cli-usage]] — usage text printed for invalid local commands.

## Referenced by

[[app/_MOC]] · [[src/_MOC]]
