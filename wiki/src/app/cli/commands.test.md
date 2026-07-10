---
type: module
path: '@root/src/app/cli/commands.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, cli, parser]
aliases: [cli-commands.test, commands.test]
---

# CLI Command Parser Tests

## Purpose

Provide the broad executable contract for [[cli-commands]] argv-to-request
projection across worker, workspace, work, checkpoint, artifact, and review
families.

## Interface

Vitest suite for `parseArgs`; successful parses are unwrapped as `CliRequest`,
while invalid commands are asserted through the `Either.left(CliError)` channel.

## Algorithm

Pin HTTP methods, encoded route segments, query scope, optional fields, and JSON
bodies for the core command families. Cover required-flag failures, workspace
and work reads, empty checkpoint step arrays, external and inline artifacts,
client-side artifact filters, every review outcome, comma-separated approval
requirements, and a valueless optional flag followed by another flag. Finish by
rejecting unknown commands and registered groups without subcommands.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT emit raw identifiers into route segments; spaces and slashes must be
  percent-encoded.
- ❌ Do NOT consume the next `--flag` token as the value of a valueless option.
- ❌ Do NOT invent empty bodies for bodyless lifecycle actions.
- ❌ Do NOT throw for user input errors; return `CliError` in `Either.left`.
- ❌ Do NOT accept a registered command group without a concrete subcommand.

## Grill Log

- **Q:** Why retain a broad suite alongside focused feature suites? **A:** This
  suite pins cross-family parser invariants and central registration, while
  feature suites deepen volatile behavior. _Rejected:_ deleting the aggregate
  contract after splitting command modules.

## Referenced by

[[cli-commands]] · [[cli-command-support]] · [[cli/_MOC]] · [[Transport]] ·
[[src/_MOC]]
