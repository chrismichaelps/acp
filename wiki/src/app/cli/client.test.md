---
type: module
path: '@root/src/app/cli/client.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, cli, http]
aliases: [cli-client.test, client.test]
---

# CLI Client Tests

## Purpose

Prove [[cli-client]] constructs the requested HTTP method and URL, applies bearer
authentication only when configured, and narrows list responses without
corrupting host errors or non-JSON output.

## Interface

Vitest suite for `runCliRequest` using an injected Effect `HttpClient`, plus pure
coverage for `applyClientFilter`.

## Algorithm

Capture a DELETE request's method and URL, then exercise POST requests with and
without an ACP token to pin the `Authorization` header policy. For client-side
filtering, assert no-filter passthrough; state, priority, and assignee matching;
conjunctive multi-filter behavior; empty matches; and unchanged non-array or
unparseable response bodies.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT attach an empty or synthetic Authorization header when no token is
  configured.
- ❌ Do NOT treat multiple client filters as alternatives; every filter must
  match.
- ❌ Do NOT throw or rewrite a host error object or unparseable body.
- ❌ Do NOT replace the injected client with a live host dependency.

## Grill Log

- **Q:** Should structural filters reject malformed host output? **A:** No.
  Filtering is a presentation convenience; transport errors and unknown payloads
  must remain observable unchanged. _Rejected:_ fail-closed JSON parsing in the
  CLI printer.

## Referenced by

[[cli-client]] · [[cli-commands]] · [[cli/_MOC]] · [[Transport]] · [[src/_MOC]]
