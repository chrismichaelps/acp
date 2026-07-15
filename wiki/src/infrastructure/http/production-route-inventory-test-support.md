---
type: module
path: '@root/src/infrastructure/http/production-route-inventory-test-support.ts'
fidelity: Active
domain: '[[Transport]]'
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.64
depth_status: MEDIUM
tags: [module, test-support, http, parity, openapi]
aliases: [production-route-inventory-test-support]
---

# Production Route Inventory Test Support

## Purpose

Extract the statically declared production `/v1` method/path inventory from
[[acp-router]] once for both [[acp-http-api.test]] and [[openapi-module.test]].
The helper makes the live router, typed contract, and generated artifact fail
together when any supported HTTP method is missing or added inconsistently.

## Interface

```typescript
export const routeKey: (method: string, path: string) => string
export const extractProductionV1RouteKeys: (source: string) => readonly string[]
export const productionV1RouteKeys: () => readonly string[]
```

## Algorithm

1. Parse `router.ts` with the TypeScript compiler API instead of matching source
   formatting with a regular expression.
2. Recognize every method-specific `HttpRouter` helper: GET, POST, PATCH, PUT,
   DELETE (`del`), HEAD, and OPTIONS.
3. Recognize the generic `HttpRouter.route(method)(path, handler)` form so TRACE
   and every standard OpenAPI method remain visible.
4. Require literal method and path declarations for production inventory;
   normalize `:parameter` segments to OpenAPI `{parameter}` form.
5. Reject wildcard `HttpRouter.all` registrations under `/v1`, because one
   wildcard cannot map truthfully to one typed OpenAPI operation.
6. Return a sorted, duplicate-preserving method/path list for exact comparison.

## Edge Cases

- GET and POST on the same path are distinct inventory entries.
- DELETE uses the Effect helper name `del` but normalizes to `DELETE`.
- TRACE is expressed through the generic `route` helper because Effect exposes
  no method-specific TRACE helper.
- Dynamic production methods or paths are rejected instead of silently omitted.
- Non-`/v1` health, readiness, discovery, and RPC routes remain outside the REST
  contract comparison.

## Negative Logic

- Do not maintain separate extraction logic in each test file.
- Do not sample representative paths or a subset of HTTP verbs.
- Do not treat `HttpRouter.all` as one documentable operation.
- Do not evaluate or import the production router merely to inspect declarations.

## Grill Log

- **Q:** Is a four-verb regular expression sufficient today? **A:** No; it lets a
  future router-only PUT, HEAD, OPTIONS, or TRACE bypass the parity gate.
  _Rejected:_ documenting the current four-verb subset as permanent policy.
- **Q:** Why parse TypeScript instead of widening the regular expression?
  **A:** The AST is insensitive to formatting and supports both pipeable and
  direct helper overloads. _Rejected:_ two duplicated formatting-sensitive
  parsers.
- **Q:** Should wildcard routes expand to all methods? **A:** No; that would
  fabricate operation schemas. _Rejected:_ silently treating one handler as
  eight typed contracts.

## Depth

MEDIUM (0.64). One strict parser removes duplicated test logic and closes an
entire class of method-blind production drift.

## Referenced by

[[acp-http-api.test]] · [[openapi-module.test]] · [[http/_MOC]] ·
[[ADR-0017-openapi-contract-artifact]] · [[2026-07-14-openapi-contract]]
