---
type: module
path: '@root/src/infrastructure/storage/index-columns.ts'
fidelity: Active
domain: '[[Storage]]'
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
tags: [module, storage, indexing]
aliases: [index-columns, INDEXED_FIELDS, extractIndexColumns]
---

# Index Columns (promoted-column allowlist)

## Purpose

The single source of truth for which record fields get promoted to indexed columns
across all storage adapters. Eliminates divergence risk: all adapters (InMemory,
SQLite, etc.) must use this same allowlist and extractor.

## Interface

### Signatures

```typescript
export const INDEXED_FIELDS: readonly string[] = [
  'workspace_id', 'work_id', 'state', 'assigned_to', 'priority', 'holder', 'kind'
]

export type IndexedField = (typeof INDEXED_FIELDS)[number]

export const extractIndexColumns(
  value: unknown,
): Record<IndexedField, string | null>
```

Extracts indexed columns from a record: returns an object with a key for each
indexed field. If the record is a non-null object and has a string value for that
field, includes it; otherwise nulls that field. Non-object inputs return all-null.

## Grill Log

- Single source of truth for promoted columns; adapters must not diverge
