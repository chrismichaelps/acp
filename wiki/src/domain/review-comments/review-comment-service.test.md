---
type: module
path: '@root/src/domain/review-comments/review-comment-service.test.ts'
fidelity: Active
domain: '[[ReviewComment]]'
grammar: '[[grammar/typescript]]'
tags: [module, test, domain, review-comment]
aliases: [review-comment-service.test]
---

# Review Comment Service Tests

## Purpose

Pin [[review-comment-service]] open creation, review indexing, resolution
timestamps, and provider-id stamping without inventing a state transition.

## Interface

Vitest suite over in-memory [[Storage]] and [[event-store]].

## Algorithm

Add a diff-anchored comment and require state `open` plus review-scoped listing.
Resolve it with a second worker and later timestamp, requiring state `resolved`
and a populated `resolved_at`. Stamp an external GitHub comment id, read the
record back, and require the provider id is persisted.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT create comments in a resolved state.
- ❌ Do NOT resolve without stamping resolution time.
- ❌ Do NOT lose review indexing after a state change.
- ❌ Do NOT model `setExternalId` as resolve/reopen or emit a false transition.

## Grill Log

- **Q:** Why is external-id stamping state-neutral? **A:** It records provider
  provenance for reconciliation; discussion obligation state remains unchanged.
  _Rejected:_ conflating synchronization metadata with reviewer resolution.

## Referenced by

[[review-comment-service]] · [[review-comments/_MOC]] · [[ReviewComment]] ·
[[src/_MOC]]
