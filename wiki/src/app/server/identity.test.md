---
type: module
path: '@root/src/app/server/identity.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
tags: [module, test, app, server, identity, security]
aliases: [id-clock.test, identity.test]
---

# IdClock Tests

## Purpose

Pin [[id-clock]] ordinary identifier uniqueness, timestamp formatting, and the
separate high-entropy credential-minting contract.

## Interface

Vitest suite providing effects with `IdClockLive` and resolving the `IdClock`
service synchronously.

## Algorithm

Mint two work ids and require the `work_` prefix plus uniqueness. Read `now` and
require a round-trippable ISO-8601 value. Advance the observable ordinary-id
counter, mint two session tokens back-to-back, and require `session_` plus 64
hex characters, distinct values, and distinct leading entropy segments.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT mint bearer tokens from the timestamp/counter identifier path.
- ❌ Do NOT accept a shorter or non-hex credential suffix.
- ❌ Do NOT let adjacent secure tokens share a predictable prefix segment.
- ❌ Do NOT emit a timestamp that cannot round-trip through ISO formatting.

## Grill Log

- **Q:** Does two-token inequality prove cryptographic security? **A:** No; this
  regression pins the public shape and rejects obvious counter/time derivation,
  while Node CSPRNG ownership is defined by [[id-clock]]. _Rejected:_ overstating
  statistical assertions as an entropy proof.

## Referenced by

[[id-clock]] · [[acp-router]] · [[server/_MOC]] · [[src/_MOC]]
