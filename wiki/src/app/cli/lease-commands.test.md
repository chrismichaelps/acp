---
type: module
path: '@root/src/app/cli/lease-commands.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, cli, lease]
aliases: [cli-lease-commands.test, lease-commands.test]
---

# CLI Lease Command Tests

## Purpose

Prove [[cli-lease-commands]] maps resource claims, readback, renewal, release,
and revocation into the correct typed request shapes.

## Interface

Vitest suite driving lease argv through the central [[cli-commands|parseArgs]]
registry.

## Algorithm

Build a lease request with a nested resource and numeric TTL, then reject a
non-numeric TTL before HTTP. Map workspace-scoped list queries and optional
holder filtering, prove release has no body, and assert encoded lease ids plus
request shapes for renew and revoke.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT forward invalid TTL text for schema decoding at the host.
- ❌ Do NOT send `--holder` as an unsupported server query; preserve it as a
  client filter.
- ❌ Do NOT attach a body to release or revoke.
- ❌ Do NOT place an unencoded lease id in a route.

## Grill Log

- **Q:** Should omitted renew TTL become a CLI default? **A:** No. The host's
  configured default remains authoritative. _Rejected:_ duplicating lease policy
  in argv parsing.

## Referenced by

[[cli-lease-commands]] · [[cli-commands]] · [[cli-client]] · [[cli/_MOC]] ·
[[src/_MOC]]
