---
type: module
path: '@root/src/infrastructure/http/acp-http-api.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, infrastructure, http, contract]
aliases: [acp-http-api.test]
---

# ACP HTTP API Tests

## Purpose

Pin [[acp-http-api]] capability negotiation, workspace binding, runtime protocol
version negotiation, progress-event vocabulary, and the complete v0.1 reflected
REST route inventory. It also compares that declaration with the explicit
production registrations in [[acp-router]].

## Interface

Vitest contract suite over Effect Schema decoding and `HttpApi.reflect`.

## Algorithm

Decode the spec-shaped initialization payload and require default worker status
and capabilities. Decode optional workspace bindings. Preserve a future protocol
version for runtime compatibility checks. Decode `InitializeSessionResponse`
with exact `permissions` and workspace bindings, including each additive
ADR-0013 review literal in a separate fixture; reject a response that drops the
permission echo. Reject initialization payloads and response records containing
both scopes with the exact mutual-exclusion issue.
Accept only `work.progressed` through the public work-event payload. Reflect
`AcpHttpApi` and compare every endpoint's group, name, method, and path against
the ordered v0.1 route contract. Normalize parameter syntax, extract every
explicit `/v1` `HttpRouter` registration, and require exact method/path set
equality with all 53 typed operations. [[production-route-inventory-test-support]]
recognizes GET, POST, PATCH, PUT, DELETE, HEAD, OPTIONS, and generic TRACE
declarations and rejects wildcard or dynamic `/v1` registrations.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT reject a syntactically valid future version during schema decoding.
- ❌ Do NOT admit lifecycle or review events through the progress-event route.
- ❌ Do NOT add, remove, rename, reorder, or remap a REST endpoint invisibly.
- ❌ Do NOT discard optional hosted workspace bindings.
- ❌ Do NOT accept a session response that cannot echo the exact effective
  permission array.
- ❌ Do NOT combine `review:respond` and `review:collaborate` in one session.
- ❌ Do NOT use representative route sampling as a production-parity gate.
- ❌ Do NOT let a method-specific or generic HTTP registration bypass inventory
  extraction because its verb or formatting is unfamiliar.

## Grill Log

- **Q:** Why compare the entire reflected route list? **A:** The declaration is
  the transport's executable inventory; exact reflection catches accidental
  path, verb, group, and ordering drift in one reviewable contract. _Rejected:_
  spot-checking only high-traffic routes.

## Referenced by

[[acp-http-api]] · [[http/_MOC]] · [[Transport]] · [[src/_MOC]]
· [[acp-http-api-reviews]] · [[openapi-module.test]] ·
[[production-route-inventory-test-support]]
