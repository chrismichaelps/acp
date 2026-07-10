---
type: module
path: '@root/src/app/cli/gh-bridge-support.ts'
fidelity: Active
domain: '[[Review]]'
grammar: '[[grammar/typescript]]'
seam: '[[GitHub]]'
depth_score: 0.62
depth_status: MEDIUM
tags: [module, medium]
aliases: [gh-bridge-support, BridgeError, acpGet, acpPost]
---

# GitHub Bridge ACP Support

## Purpose

Provide typed GET/POST helpers for [[gh-bridge]] to call ACP through the same
[[cli-client]] transport boundary as the command-line client.

## Interface

```typescript
export class BridgeError extends Data.TaggedError('BridgeError')<{
  readonly message: string
}> {}
export const acpGet: (...) => Effect<unknown, BridgeError, HttpClient>
export const acpPost: (...) => Effect<unknown, BridgeError, HttpClient>
```

## Algorithm

Build a `CliRequest`, call `runCliRequest`, map transport failures and non-2xx
responses to `BridgeError`, and parse a non-empty success body as JSON (`null` for
empty bodies).

## Negative Logic

- ❌ Do NOT duplicate auth/header/client implementation outside [[cli-client]].
- ❌ Do NOT accept HTTP status ≥400 as a successful bridge value.
- ❌ Do NOT throw for transport or JSON failures.

## Depth

MEDIUM (0.62). Two functions hide request construction, status folding, JSON
parsing, and error normalization.

## Grill Log

- **Q:** Why return `unknown`? **A:** Each bridge operation owns its wire shape;
  this helper centralizes transport mechanics without inventing a second schema
  hierarchy. _Rejected:_ untyped exceptions (break Effect error composition).

## Referenced by

[[gh-bridge]] · [[cli/_MOC]]
