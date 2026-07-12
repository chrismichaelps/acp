---
type: module
path: '@root/src/infrastructure/http/http-error-mapper.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, infrastructure, http, errors]
aliases: [http-error-mapper.test]
---

# HTTP Error Mapper Tests

## Purpose

Prove [[http-error-mapper]] status mapping and its security-critical rule that
storage causes never enter the JSON response body.

## Interface

Vitest unit suite over `toHttpErrorResponse` and tagged protocol errors.

## Algorithm

Map `NotFoundError` to 404 and `InvalidStateTransitionError` to 409. Map a
`StorageError` containing a private local path to 500 and require the serialized
body not to contain that cause.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT collapse not-found and state-conflict failures into status 500.
- ❌ Do NOT serialize storage causes, paths, or implementation details.

## Grill Log

- **Q:** Why assert on serialized JSON rather than only the typed body? **A:**
  Leakage matters at the wire representation; serialization is the final
  security boundary. _Rejected:_ trusting constructor shape alone.

## Referenced by

[[http-error-mapper]] · [[http/_MOC]] · [[Transport]] · [[src/_MOC]]
