---
type: test
path: '@root/src/infrastructure/http/openapi.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [test, http, openapi, drift-gate]
aliases: [openapi-module.test]
---

# OpenAPI Contract Tests

## Purpose

Pin the semantic and byte-level promises of [[openapi-module]]. The suite is the
executable drift gate between [[acp-http-api]], security repair, and the committed
`openapi.json` artifact.

## Contract

- emits OpenAPI 3.x identity with the current [[protocol-version]];
- includes representative collection, item, and path-parameter routes;
- defines `AcpSession` and `AcpIssuance` as distinct HTTP bearer schemes;
- gives `session.initializeSession` the optional issuance alternatives
  `AcpIssuance` or public compatibility and requires `AcpSession` everywhere
  else;
- requires 401 and 403 ProtocolError responses on every protected operation;
- compares all 53 OpenAPI method/path pairs with the production `/v1` router
  through [[production-route-inventory-test-support]] across every supported HTTP
  method rather than sampling representative paths or verbs;
- produces identical bytes across repeated builds; and
- equals the checked-in artifact byte-for-byte.

## Negative Logic

- Do not weaken the gate to structural JSON equality; byte drift is intentional
  review evidence.
- Do not sample only one protected operation; enumerate all declared operations.
- Do not let the generated artifact and typed declaration agree while both omit a
  production router registration.
- Do not use a method-limited regular expression for production inventory.
- Do not regenerate the artifact from inside the test.

## Referenced by

[[openapi-module]] · [[ADR-0017-openapi-contract-artifact]] · [[http/_MOC]] ·
[[2026-07-14-openapi-contract]] ·
[[production-route-inventory-test-support]]
