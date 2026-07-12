---
type: module
path: '@root/src/protocol/version.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
tags: [module, test, protocol, version]
aliases: [protocol-version.test, version.test]
---

# Protocol Version Tests

## Purpose

Prove [[protocol-version]] declares and decodes exactly the currently supported
ACP version.

## Interface

Vitest contract suite over the version constant, supported set, predicate, and
schema.

## Algorithm

Require current version and supported versions to equal `0.1`; accept `0.1` and
reject `0.2` through both the predicate and schema decoder.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT advertise a version the schema rejects.
- ❌ Do NOT decode a future version before a compatibility decision.

## Grill Log

- **Q:** Why reject `0.2` explicitly? **A:** Future-looking strings must reach
  named negotiation as unsupported, not silently widen the canonical version
  type. _Rejected:_ permissive version schema.

## Referenced by

[[protocol-version]] · [[protocol/_MOC]] · [[src/_MOC]]
