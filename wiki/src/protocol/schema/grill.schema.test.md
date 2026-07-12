---
type: module
path: '@root/src/protocol/schema/grill.schema.test.ts'
fidelity: Active
domain: '[[Grill]]'
grammar: '[[grammar/typescript]]'
tags: [module, test, protocol, schema, grill]
aliases: [grill.schema.test]
---

# Grill Schema Tests

## Purpose

Pin [[grill.schema]] open-gate and unanswered blocker wire decoding.

## Interface

Vitest schema-decoding suite over `Grill` and `GrillQuestion`.

## Algorithm

Decode an open grill with no closure timestamp. Decode a blocker question with
no answer, actor, or decision timestamps and require verdict `pending` plus
`Option.none` answer semantics.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT require closure data for an open gate.
- ❌ Do NOT turn absent question answers into empty strings.
- ❌ Do NOT infer a verdict before reviewer decision.

## Grill Log

- **Q:** Why pin pending blockers? **A:** Unanswered blockers are the state that
  must hold a production review gate open. _Rejected:_ testing only completed
  grills.

## Referenced by

[[grill.schema]] · [[schema/_MOC]] · [[Grill]] · [[src/_MOC]]
