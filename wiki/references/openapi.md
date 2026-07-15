---
type: reference
tags: [reference, http, contract, tooling]
aliases: [openapi, openapi-contract]
---

# OpenAPI Contract (`openapi.json`)

ACP publishes a machine-readable description of its REST surface as `openapi.json`
at the repository root, and the running host serves the same document live and
unauthenticated at `GET /openapi.json`. It is generated from the typed
`AcpHttpApi` contract, so it always reflects the routes the host actually serves.
Policy and rationale live in [[ADR-0017-openapi-contract-artifact]].

The production-parity gate compares all 53 published method/path pairs with the
explicit `/v1` registrations in [[acp-router]]. This catches a live route missing
from the typed declaration even when the generated file matches that declaration.

The contract describes the production authorization posture: every declared REST
operation except `session.initializeSession` carries the `AcpSession` HTTP bearer
scheme. A local host may disable enforcement with `ACP_REQUIRE_AUTH=false`; hosted
identity is still limited by [[ADR-0015-trusted-session-issuance]].
Protected operations also document the router's standard `401` and `403`
ProtocolError responses.

## What it is for

- **Generate clients in any language.** Point an OpenAPI generator at
  `openapi.json` and get a typed client for Go, Python, Rust, and so on, instead
  of hand-writing HTTP calls.
- **Browse the surface before adopting.** Load it into Swagger UI, Postman, or any
  OpenAPI viewer to explore every endpoint, request body, and response shape.
- **Catch accidental API changes.** The committed artifact is gated, so a change
  to the REST surface shows up as a reviewable diff and cannot land silently.

## How it is produced

- `src/infrastructure/http/openapi.ts` — `buildAcpOpenApi()` derives the document
  from `AcpHttpApi` via `OpenApi.fromApi` and pins `info.title` to `ACP` and
  `info.version` to the protocol version (`ACP_PROTOCOL_VERSION`).
- `scripts/generate-openapi.mjs` — writes the canonical `openapi.json`.
- `openapi.test.ts` — the drift gate: re-derives the document from source and
  asserts it byte-for-byte equals the committed file.

The generator also repairs security metadata that cannot be inferred from the
typed route declaration because authorization is applied in [[acp-router]],
including bearer requirements and standard auth error responses.

## Regenerating after an API change

Change a route, then:

```bash
pnpm openapi:generate   # builds, then rewrites openapi.json
pnpm check:openapi      # confirms the committed artifact matches the contract
```

The `version` field is the protocol version, not the release version. It moves
only when the wire contract does — see [[version-bump]].

## Stability inside 0.x

Within one protocol version, existing operation ids, methods/paths, required
inputs, response fields/statuses, enums, security requirements, and meanings are
backward compatible. Additive operations and optional fields are allowed when an
older client can ignore them. Incompatible changes require an explicit protocol
bump and a reviewed generated diff; regeneration alone is not approval.

## Negative Logic

- Do not edit `openapi.json` by hand.
- Do not publish empty security metadata for protected routes.
- Do not equate the bearer scheme with trusted public identity.
- Do not stamp the document with package release semver.

## Referenced by

[[ADR-0017-openapi-contract-artifact]] · [[openapi-module]] ·
[[openapi-module.test]] · [[openapi-route]] · [[references/_MOC]] ·
[[2026-07-14-openapi-contract]]
