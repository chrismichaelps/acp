---
type: module
path: '@root/src/app/cli/command-registry.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, cli, parser]
aliases: [cli-command-registry.test, command-registry.test]
---

# CLI Command Registry Tests

## Purpose

Pin [[cli-commands]] registry composition and prefix resolution so feature maps
remain additive without ambiguous or silently overwritten commands.

## Interface

Vitest suite for `buildCommandRegistry` and `buildCommandParser` using small
in-memory `CommandHandler` tables.

## Algorithm

Register the same command key twice and assert construction fails with the
duplicate name. Build a parser with one-, two-, and three-token commands and
assert each routes correctly with remaining positionals. Register overlapping
two- and three-token keys and prove the longest matching prefix wins.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT let later feature maps overwrite duplicate command names.
- ❌ Do NOT assume every command has exactly two tokens.
- ❌ Do NOT dispatch an overlapping shorter prefix before checking the longest
  registered key.

## Grill Log

- **Q:** Why test three-token commands before production needs many of them?
  **A:** Command arity is registry data; the test prevents a future refactor from
  restoring fixed group/action slicing. _Rejected:_ only testing current
  two-token commands.

## Referenced by

[[cli-commands]] · [[cli-command-support]] · [[cli/_MOC]] · [[src/_MOC]]
