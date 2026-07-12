---
type: module
path: '@root/src/domain/artifacts/artifact-service.test.ts'
fidelity: Active
domain: '[[Artifact]]'
grammar: '[[grammar/typescript]]'
tags: [module, test, domain, artifact]
aliases: [artifact-service.test]
---

# Artifact Service Tests

## Purpose

Prove [[artifact-service]] owns metadata/content consistency, evidence bounds,
work/workspace indexes, identity-preserving updates, storage-mode transitions,
events, and missing-resource behavior.

## Interface

Vitest suite composed over in-memory [[Storage]], [[event-store]], and a 16-byte
artifact limit.

## Algorithm

Create host-stored evidence and require `acp://` metadata, private content, and
`artifact.created`; create external evidence and require no private content.
Reject missing evidence and oversized creates. Pin work/workspace indexes.
Update metadata/content while preserving identity/provenance and emitting
`artifact.updated`; preserve content on metadata-only updates; switch safely
between host and external ownership; reject oversized updates. Remove metadata
and content with `artifact.deleted`, return `Option.none` on get-missing, and
raise `NotFoundError` on remove-missing.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT persist content when an explicit external URI owns the bytes.
- ❌ Do NOT allow content beyond configured bounds on create or update.
- ❌ Do NOT remint id, URI, creator, or creation timestamp during ordinary update.
- ❌ Do NOT leave stale private content when switching to external ownership.
- ❌ Do NOT emit lifecycle events before the matching storage mutation succeeds.

## Grill Log

- **Q:** Why can switching back to local content change URI? **A:** The old
  external URI names provider-owned bytes; local bytes require the canonical
  `acp://artifacts/{id}` handle. _Rejected:_ retain a lying external URI.

## Referenced by

[[artifact-service]] · [[event-store]] · [[artifacts/_MOC]] · [[Artifact]] ·
[[src/_MOC]]
