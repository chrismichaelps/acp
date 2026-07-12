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
REST route inventory.

## Interface

Vitest contract suite over Effect Schema decoding and `HttpApi.reflect`.

## Algorithm

Decode the spec-shaped initialization payload and require default worker status
and capabilities. Decode optional workspace bindings. Preserve a future protocol
version for runtime compatibility checks. Accept only `work.progressed` through
the public work-event payload. Reflect `AcpHttpApi` and compare every endpoint's
group, name, method, and path against the ordered v0.1 route contract.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT reject a syntactically valid future version during schema decoding.
- ❌ Do NOT admit lifecycle or review events through the progress-event route.
- ❌ Do NOT add, remove, rename, reorder, or remap a REST endpoint invisibly.
- ❌ Do NOT discard optional hosted workspace bindings.

## Grill Log

- **Q:** Why compare the entire reflected route list? **A:** The declaration is
  the transport's executable inventory; exact reflection catches accidental
  path, verb, group, and ordering drift in one reviewable contract. _Rejected:_
  spot-checking only high-traffic routes.

## Referenced by

[[acp-http-api]] · [[http/_MOC]] · [[Transport]] · [[src/_MOC]]
