---
type: module
path: '@root/src/app/cli/client.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.6
depth_status: MEDIUM
tags: [module, medium]
aliases: [cli-client, runCliRequest]
---

# CLI Client

## Purpose

Send a [[cli-commands|CliRequest]] to the local ACP host over `HttpClient` and
return the decoded result, so the CLI is a thin client of [[acp-router]].

## Interface

### Signatures

```typescript
export interface CliResult {
  readonly status: number
  readonly body: string
}
export const runCliRequest: (
  request: CliRequest,
  baseUrl: string,
) => Effect<CliResult, HttpClientError, HttpClient.HttpClient>
```

### Linkage

- **Requires:** `@effect/platform` `HttpClient`/`HttpClientRequest`,
  [[cli-commands]].
- **Consumed by:** [[cli-main]] (provides `NodeHttpClient.layer`) and CLI tests
  (provide a fake `HttpClient` backed by the [[acp-router]] web handler).

## Algorithm

Build a `GET`/`POST`/`PATCH` `HttpClientRequest` for `${baseUrl}${path}`, attach a
JSON body when present, `execute`, read the response text, return
`{ status, body }`. Streaming (`events stream`) is handled by [[cli-main]].

## Negative Logic (Prohibited Paths)

- ❌ Do NOT decode into domain schemas here — the CLI prints raw JSON.
- ❌ Do NOT pick the transport Layer here — [[cli-main]] provides it.

## Depth

MEDIUM (0.6). Hides request construction + response reading behind one function;
transport-agnostic via the `HttpClient` tag (testable against the router).

## Referenced by

[[cli-index]] · [[cli-main]] · [[Transport]] · [[src/_MOC]]
