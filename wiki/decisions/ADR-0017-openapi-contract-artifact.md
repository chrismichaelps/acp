---
type: decision
status: ACCEPTED
date: 2026-07-14
tags: [adr, accepted, http, contract, tooling]
aliases: [ADR-0017, openapi-contract-artifact]
---

# ADR-0017 — Publish an OpenAPI Contract Artifact

## Status

ACCEPTED — 2026-07-14.

## Context

The REST surface is defined once, as typed `@effect/platform` `HttpApi` groups in
`src/infrastructure/http/acp-http-api.ts`. That definition is authoritative for
the running host, but it is only legible to someone reading TypeScript. A
developer working in another language, or evaluating the surface before adopting
ACP, has no machine-readable description to generate a client from or to browse.

[[ADR-0004-protocol-version-codecs-generated-client]] deferred generated client
output "until there is a concrete consumer and a stable artifact policy." Both now
exist: [[version-bump]] gives us an explicit protocol-version line to stamp the
contract with, and external adopters are the concrete consumer. What was missing
is the artifact and a rule that keeps it honest.

## Decision

Emit an OpenAPI document from the existing `AcpHttpApi` contract and commit it as
`openapi.json` at the repository root.

- `src/infrastructure/http/openapi.ts` exposes `buildAcpOpenApi()`, which calls
  `OpenApi.fromApi(AcpHttpApi)` and pins the identity fields. `info.version`
  tracks `ACP_PROTOCOL_VERSION` — the wire contract an OpenAPI consumer depends
  on — not the release version.
- `serializeOpenApi` defines the canonical on-disk form. `scripts/generate-openapi.mjs`
  (npm `openapi:generate`, which builds first) regenerates the committed file.
- A vitest drift gate in `openapi.test.ts` re-derives the document from source and
  asserts it byte-for-byte equals the committed `openapi.json`. The document is a
  generated projection of the typed routes, so the gate — not review vigilance —
  is what prevents drift. `openapi.json` is Prettier-ignored so the gate is its
  sole authority.

The running host also serves the document live and unauthenticated at
`GET /openapi.json` (wired through `router.ts` and `native-rpc-route.ts`, computed
once at load), so the contract is fetchable from a host without cloning the repo.

The artifact covers the REST transport. Native RPC keeps its own `@effect/rpc`
schema surface and is out of scope here.

## Rationale

Generating from the typed routes means the contract cannot silently disagree with
the host: there is one definition, and the artifact is derived from it under a
gate. Committing the file (rather than only generating on demand) makes the
surface reviewable in diffs and fetchable without a build, which is the point for
external evaluators. Stamping it with the protocol version ties the published
surface to the compatibility line we already reason about, so "what is stable
inside 0.x" has a concrete referent.

The drift gate imports from source, so it runs inside the normal `pnpm test` gate
with no build step; only human regeneration needs the compiled contract.

## Consequences

Publishing `openapi.json` is a promise: a change to the REST surface now shows up
as a diff to the artifact and must be regenerated deliberately, which is the
intended friction. Language-agnostic client generation and interactive API
browsing become downstream of a single committed file or the live
`GET /openapi.json` endpoint. Generating typed clients from it remains an open
follow-up ([[references/_MOC|references]]).
