---
type: module
path: '@root/src/domain/sessions/session-issuer.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
tags: [module, test, auth]
aliases: [session-issuer.test]
---

# Session Issuer Tests

## Purpose

Pin the trusted-client compatibility adapter before hosted/static policy is
wired into the application.

## Interface

Vitest exercises the public [[session-issuer]] service through its Layer.

## Algorithm

- Issue without a credential and require exact requested worker, permissions,
  capabilities, and optional bindings plus absent provenance.
- Validate a local session unchanged.
- Preserve ADR-0013 permission refinement through already-decoded request types.

## Negative Logic

- Do not test the static credential algorithm here; it belongs to
  [[session-issuer-live.test]].
- Do not mock transport request objects.

## Depth

MEDIUM. A small compatibility gate protects local behavior while the seam grows
new adapters.

## Referenced by

[[session-issuer]] · [[sessions/_MOC]]
