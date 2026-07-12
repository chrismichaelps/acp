---
type: module
path: '@root/src/protocol/errors/protocol-error.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
tags: [module, test, protocol, errors]
aliases: [protocol-error.test]
---

# Protocol Error Tests

## Purpose

Prove [[protocol-error]] is a total, stable status/code mapping that preserves
actionable conflict data without leaking storage internals.

## Interface

Vitest table-driven suite over every `DomainError` variant and
`toProtocolError`.

## Algorithm

Require validation/auth/forbidden/not-found/claim/lease/state/capability/storage
errors to map to their exact HTTP status and protocol code. Collapse storage
causes to a detail-free internal error. Preserve holder identity for lease
conflicts and work plus holder identity for claim conflicts.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT leak storage cause/path details.
- ❌ Do NOT collapse authorization denial into authentication failure.
- ❌ Do NOT lose holder/work context from coordination conflicts.

## Grill Log

- **Q:** Why table-test every variant? **A:** The mapping is the closed wire
  policy; an untested branch can silently change every transport. _Rejected:_
  representative status spot checks.

## Referenced by

[[protocol-error]] · [[errors/_MOC]] · [[Transport]] · [[src/_MOC]]
