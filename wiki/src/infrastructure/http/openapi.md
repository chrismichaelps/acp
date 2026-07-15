---
type: module
path: '@root/src/infrastructure/http/openapi.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.58
depth_status: MEDIUM
tags: [module, http, openapi, generated-contract]
aliases: [openapi-module, buildAcpOpenApi]
---

# OpenAPI Contract Projection

## Purpose

Project the typed [[acp-http-api]] REST declaration into the canonical OpenAPI
3.1 contract used by external tooling, the committed `openapi.json` artifact,
and the live [[openapi-route]]. The module also restores the bearer-security
metadata that Effect cannot infer because authorization is applied by
[[acp-router]] outside the declarative route schema.

## Interface

```typescript
export const buildAcpOpenApi: () => OpenApi.OpenAPISpec
export const serializeOpenApi: (document: OpenApi.OpenAPISpec) => string
```

`info.version` is [[protocol-version]] rather than package semver. The document
defines `AcpSession` as an HTTP bearer scheme. Every operation requires it except
`session.initializeSession`, which is the public bootstrap operation.

## Algorithm

1. Derive the base specification with `OpenApi.fromApi(AcpHttpApi)`.
2. Pin ACP title, protocol version, and generation guidance.
3. Add the `AcpSession` security scheme and a default bearer requirement.
4. Walk every declared HTTP operation, retaining an empty security array only
   for `session.initializeSession` and assigning `AcpSession` everywhere else.
5. Add the router authorization layer's standard `401` and `403` ProtocolError
   responses to every protected operation, preserving operation-specific errors.
6. Serialize deterministically as two-space JSON with one terminal newline.

The projection is pure and performs no filesystem access. Artifact writing is
owned by the generation script; live serving is owned by [[openapi-route]].

## Negative Logic (Prohibited Paths)

- Do not maintain a hand-written OpenAPI contract beside [[acp-http-api]].
- Do not return a local partial-document type or cast through `unknown`; use the
  upstream `OpenApi.OpenAPISpec` contract.
- Do not publish Effect's empty security arrays unchanged.
- Do not omit the authorization layer's 401/403 responses from protected routes.
- Do not model local `ACP_REQUIRE_AUTH=false` as the production client contract.
- Do not edit `openapi.json` manually or read it from request handling code.

## Depth

MEDIUM (0.58). The code is a compact projection, but it hides three policies from
consumers: identity/version pinning, router-level auth repair, and canonical byte
serialization.

## Grill Log

- **Q:** Is a global bearer requirement enough? **A:** No. Operations are given
  explicit security arrays so generated clients do not inherit ambiguous output,
  while session initialization explicitly opts out.
- **Q:** Does the bearer scheme prove hosted identity? **A:** No. It describes
  current session transport only; [[ADR-0015-trusted-session-issuance]] owns the
  hostile-client boundary.

## Referenced by

[[openapi-module.test]] · [[openapi-route]] · [[openapi]] ·
[[ADR-0017-openapi-contract-artifact]] · [[http/_MOC]] · [[Transport]] ·
[[2026-07-14-openapi-contract]] · [[acp-http-api-reviews]]
