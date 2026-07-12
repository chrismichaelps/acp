---
type: module
path: '@root/src/app/cli/grill-commands.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, cli, grill, review-gate]
aliases: [cli-grill-commands.test, grill-commands.test]
---

# CLI Grill Command Tests

## Purpose

Prove [[cli-grill-commands]] projects the complete forced-question workflow and
enforces an explicit exclusive verdict.

## Interface

Vitest suite driving grill argv through the central [[cli-commands|parseArgs]]
registry.

## Algorithm

Assert open carries review/work/workspace identity, ask carries severity and
prompt, and answer targets a question. Map `--accept` and `--reject` to their
literal verdicts, rejecting both the neither and both cases. Pin bodyless
evaluate/get requests and review-scoped listing.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT accept a verdict without exactly one decision flag.
- ❌ Do NOT forward a caller-supplied opener; auth derives it at the server.
- ❌ Do NOT evaluate the grill inside the parser.
- ❌ Do NOT attach bodies to evaluate or get requests.

## Grill Log

- **Q:** Why reject both flags instead of choosing the last one? **A:** A blocker
  verdict must be unambiguous and deliberate. _Rejected:_ argv-order precedence
  for mutually exclusive review evidence.

## Referenced by

[[cli-grill-commands]] · [[cli-commands]] · [[cli/_MOC]] · [[Transport]] ·
[[src/_MOC]]
