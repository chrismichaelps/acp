---
type: module
path: '@root/src/domain/sessions/session-service.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
tags: [module, test, domain, session, auth]
aliases: [session-service.test]
---

# Session Service Tests

## Purpose

Pin [[session-service]] registry persistence, optional workspace bindings, bearer
actor resolution, and unknown-token absence.

## Interface

Vitest suite over `SessionServiceLive` and in-memory [[Storage]].

## Algorithm

Create and read a session. Create a session with two workspace ids and require
the optional binding persists exactly. Resolve a stored token to its worker id;
resolve an unknown token to `Option.none`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT drop workspace bindings during encode/decode.
- ❌ Do NOT resolve an actor from any value other than the stored session.
- ❌ Do NOT throw a transport authorization error for an unknown token.
- ❌ Do NOT merge session registry state into worker records.

## Grill Log

- **Q:** Why return `Option.none` for unknown tokens? **A:** The service owns
  lookup, while transport/config owns whether absence falls back locally or
  becomes 401. _Rejected:_ hard-coded auth policy in the domain registry.

## Referenced by

[[session-service]] · [[sessions/_MOC]] · [[acp-router]] · [[src/_MOC]]
