---
type: module
path: '@root/src/app/server/openapi-route.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.34
depth_status: MEDIUM
tags: [module, server, http, openapi]
aliases: [openapi-route, openApiDocumentRoute]
---

# OpenAPI Discovery Route

## Purpose

Serve the canonical [[openapi-module]] projection at unauthenticated
`GET /openapi.json`, allowing client generators and explorers to discover the
REST contract before a session exists.

## Interface

```typescript
export const openApiDocumentRoute: Effect.Effect<HttpServerResponse.HttpServerResponse>
```

## Algorithm

Build the immutable OpenAPI document once at module load and return it through
[[route-support]] as an `application/json` response with status `200`. The route
performs no storage, authentication, or filesystem access.

## Negative Logic

- Do not rebuild the static document per request.
- Do not read `openapi.json` from the runtime filesystem.
- Do not expose ACP data, credentials, or runtime configuration in the document.
- Do not accept methods other than `GET`.

## Depth

MEDIUM (0.34). The handler is intentionally thin but protects discovery,
single-build, response-type, and no-filesystem invariants.

## Referenced by

[[openapi-route.test]] · [[acp-router]] · [[native-rpc-route]] ·
[[ADR-0017-openapi-contract-artifact]] · [[server/_MOC]] · [[openapi]]
