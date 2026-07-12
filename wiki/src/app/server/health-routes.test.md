---
type: module
path: '@root/src/app/server/health-routes.test.ts'
fidelity: Active
domain: '[[Host]]'
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
tags: [module, test, app, server, health]
aliases: [health-routes.test]
---

# Health Route Tests

## Purpose

Prove [[health-routes]] exposes stable unauthenticated liveness and readiness
responses through the real [[acp-router]].

## Interface

Vitest suite creating an in-process web handler from `AppLive`, `IdClockLive`,
and `acpRouter`.

## Algorithm

Call `GET /health` without a token and require HTTP 200 plus `status=ok`, host
name `acp`, and protocol version `0.1`. Call `GET /ready` without a token against
reachable storage and require HTTP 200 plus `status=ready`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT require a bearer session for either scheduler probe.
- ❌ Do NOT omit canonical protocol identity from liveness.
- ❌ Do NOT claim readiness unless the composed storage path is reachable.
- ❌ Do NOT replace router integration with direct probe-effect assertions.

## Grill Log

- **Q:** Why test both through the full router? **A:** Probe effects can be
  correct while registration or auth wrapping is wrong. _Rejected:_ unit-only
  coverage that cannot prove public accessibility.

## Referenced by

[[health-routes]] · [[acp-router]] · [[server/_MOC]] · [[Host]] · [[src/_MOC]]
