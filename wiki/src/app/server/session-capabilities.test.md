---
type: module
path: '@root/src/app/server/session-capabilities.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
depth_score: 0.4
depth_status: MEDIUM
tags: [module, medium, test]
aliases: [session-capabilities-test]
---

# Session Capabilities Test

## Purpose

Pin the host capability descriptor returned by `POST /v1/session/initialize`
without growing the broad [[acp-router]] regression file past the source-size
guard. The current assertion protects discovery of signed review approval
evidence support.

## Interface

```typescript
describe('session host capabilities', () => {
  it('advertises signed review approval evidence support', ...)
})
```

## Algorithm

Boot the real [[acp-router]] over the in-memory [[app-live]] layer, initialize a
minimal reviewer-shaped session, and assert that the JSON response contains
`capabilities.supports_signed_review_approvals === true`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT assert review approval behavior here; [[review-service]] and dogfood
  cover persistence.
- ❌ Do NOT move this assertion into the already-large router suite.

## Depth

MEDIUM (0.4). The test is intentionally small but protects a client-visible
capability flag.

## Referenced by

[[server/_MOC]] · [[acp-router]]
