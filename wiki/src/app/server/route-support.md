---
type: module
path: '@root/src/app/server/route-support.ts'
fidelity: Active
domain: '[[Worker]]'
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.74
depth_status: DEEP
tags: [module, seam, deep]
aliases: [route-support, server-route-support]
---

# Route Support

## Purpose

Provide the shared HTTP route boundary helpers used by server route modules:
authorization, protocol-error folding, success encoding, and path-parameter
lookup. This keeps [[acp-router]] and focused route modules under the file-size
gate while preserving one canonical decode → authorize → delegate → encode
pattern. The same boundary emits Effect request lifecycle logs with stable route
templates, status codes, durations, and protocol error codes without recording
tokens, request bodies, resource identifiers, or local paths.

## Interface

### Signatures

```typescript
export const authorize: (
  scope?: Permission,
) => Effect<
  WorkerId,
  UnauthorizedError | StorageError,
  AppConfigTag | SessionService | HttpServerRequest
>
export const respond: (
  route: string,
) => <E, R>(
  effect: Effect<HttpServerResponse, E, R>,
) => Effect<HttpServerResponse, never, R>
export const ok: (
  status: number,
) => <A, I>(schema: Schema<A, I>, value: A) => Effect<HttpServerResponse>
export const pathParam: (
  key: string,
) => Effect<string, never, HttpRouter.RouteContext>
```

### Linkage

- **Requires:** [[app-config]], [[session-service]], [[http-error-mapper]],
  [[protocol-error]], [[common]]
- **Consumed by:** [[acp-router]], [[workspace-routes]]

## Algorithm

`authorize` reads the bearer token from `Authorization`, validates it through
[[session-service]], and enforces the requested scope when supplied. Missing
tokens fall back to `worker_system` only when `ACP_REQUIRE_AUTH` is false.
Credential failures (missing token in required-auth mode, unknown token) fail
`UnauthorizedError` (401); an authenticated session lacking the requested scope
fails `ForbiddenError` (403 `forbidden`, spec §15) — the caller is known, the
action is denied. Action scopes are closed in [[common]], so callers cannot
invent route-local permission strings.

`respond(route)` catches every route failure and folds tagged domain errors
through [[http-error-mapper]], parse/request failures into `invalid_request`, and
unknown defects into a non-leaking `internal_error`. The route argument is a
low-cardinality `METHOD /template/:param` label used only for telemetry. After a
response is available, `respond` emits `http request completed` through Effect's
logger with `http_method`, `http_route`, `http_status`, `duration_ms`, and
`error_code` when the route failed through the typed error channel. Statuses
below 400 log at info, client failures at warning, and server failures at error.

`ok` schema-encodes successful values before returning JSON. `pathParam` reads a
named segment from the current `HttpRouter` route context.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT duplicate authorization or error folding in individual route modules.
- ❌ Do NOT leak unknown error causes through HTTP responses.
- ❌ Do NOT log raw URLs, bearer tokens, request bodies, resource ids, or storage
  paths from the route boundary.
- ❌ Do NOT import domain services here beyond session authorization.

## Depth

DEEP (0.74). The interface is small, but it centralizes security and error
semantics that every transport route must share.

## Referenced by

[[acp-router]] · [[workspace-routes]] · [[server/_MOC]]
