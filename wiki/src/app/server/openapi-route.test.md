---
type: test
path: '@root/src/app/server/openapi-route.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [test, server, http, openapi]
aliases: [openapi-route.test]
---

# OpenAPI Discovery Route Tests

## Purpose

Prove [[openapi-route]] is wired into the production application graph rather
than existing as dead code.

## Contract

- unauthenticated `GET /openapi.json` returns `200`;
- the response is JSON and equals [[openapi-module]]'s current projection; and
- unsupported methods do not resolve to the discovery handler.

## Negative Logic

- Do not test the route as an isolated effect; exercise [[acp-router]] with the
  real `AppLive`/`IdClockLive` graph.
- Do not require a bearer token for contract discovery.

## Referenced by

[[openapi-route]] · [[server/_MOC]] · [[ADR-0017-openapi-contract-artifact]] ·
[[2026-07-14-openapi-contract]]
