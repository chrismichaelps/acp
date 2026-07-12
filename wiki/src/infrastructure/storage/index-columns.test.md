---
type: module
path: '@root/src/infrastructure/storage/index-columns.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
tags: [module, test, infrastructure, storage, indexing]
aliases: [index-columns.test]
---

# Index Column Tests

## Purpose

Pin [[index-columns]] as the complete promoted-field extractor shared by every
storage adapter.

## Interface

Vitest pure unit suite over `INDEXED_FIELDS` and `extractIndexColumns`.

## Algorithm

Extract present string fields, return every allowlisted key, and null absent
fields. For non-objects, null every field. Require `review_id` and `grill_id` to
remain promoted columns.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT omit an allowlisted key from the extractor result.
- ❌ Do NOT preserve non-string or non-object values as indexed text.
- ❌ Do NOT regress review/grill relationship fields to JSON-only scans.

## Grill Log

- **Q:** Why compare the full key set? **A:** DDL and adapters derive from this
  vocabulary; partial output silently desynchronizes query behavior. _Rejected:_
  checking only one common field.

## Referenced by

[[index-columns]] · [[kv-statements]] · [[storage/_MOC]] · [[Storage]] ·
[[src/_MOC]]
