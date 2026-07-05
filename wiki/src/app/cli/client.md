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
  token?: string,
) => Effect<CliResult, HttpClientError, HttpClient.HttpClient>
export const withBearerToken: (
  request: HttpClientRequest,
  token: string,
) => HttpClientRequest
export const applyClientFilter: (request: CliRequest, body: string) => string
```

### Linkage

- **Requires:** `@effect/platform` `HttpClient`/`HttpClientRequest`,
  [[cli-commands]].
- **Consumed by:** [[cli-main]] (provides `NodeHttpClient.layer`) and CLI tests
  (provide a fake `HttpClient` backed by the [[acp-router]] web handler).

## Algorithm

Build a `GET`/`POST`/`PATCH`/`DELETE` `HttpClientRequest` for
`${baseUrl}${path}`, attach a JSON body when present, apply
`Authorization: Bearer <token>` only when a token was supplied, `execute`, read
the response text, return `{ status, body }`. `withBearerToken` is exported so
[[cli-main]] applies the same header policy to `events stream`.
`applyClientFilter` is a pure post-fetch transform: when
`request.clientFilters` is non-empty and the body parses to a JSON array, it
keeps only elements whose named fields equal every requested value and
re-serializes; on a non-array body or parse failure it returns the body
unchanged. [[cli-main]] calls it before printing so `work list --state <s>`,
`work list --priority <p>`, `work list --assigned-to <worker_id>`,
`lease list --holder <holder>`, and `artifact list --kind <kind>` narrow output
without a host round-trip change.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT decode into domain schemas here — `applyClientFilter` does a
  structural array narrowing only, never a typed decode.
- ❌ Do NOT pick the transport Layer here — [[cli-main]] provides it.
- ❌ Do NOT log or echo bearer tokens.

## Depth

MEDIUM (0.6). Hides request construction + response reading behind one function;
transport-agnostic via the `HttpClient` tag (testable against the router).

## Referenced by

[[cli-index]] · [[cli-main]] · [[session-auth-flow-test]] · [[Transport]] ·
[[src/_MOC]]
