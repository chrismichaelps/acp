---
type: module
path: '@root/src/infrastructure/storage/kv-statements.ts'
fidelity: Active
domain: '[[Storage]]'
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
tags: [module, storage, sql]
aliases: [kv-statements, buildQueryBySql, indexColumnValues]
---

# KV Statements (SQLite kv DDL + statement SQL)

## Purpose

Holds the `kv`-table SQL that is derived from [[index-columns]] `INDEXED_FIELDS`:
the four value-mutating write statements (with promoted columns), the additive
column DDL, the composite-index DDL, the `queryBy` `SELECT` builder, and the
column-value projector. Extracted from [[sqlite-store]] under the 500-line Split
Protocol — pure strings and array maps, closing over no database handle, so the
split is a pure move. Keeping the column list in one place means the write SQL,
the query SQL, and the bound-parameter order can never drift apart.

## Interface

### Signatures

```typescript
export const putSql: string
export const putIfAbsentSql: string
export const replaceIfSql: string
export const replaceIfVersionSql: string
export const indexColumnDdls: readonly { column: string; ddl: string }[]
export const kvIndexSql: string
export const indexColumnValues: (
  columns: Record<IndexedField, string | null>,
) => (string | null)[]
export const buildQueryBySql: (
  fields: readonly string[],
  hasLimit: boolean,
) => string
```

## Algorithm

At module load, the fixed `INDEXED_FIELDS` list is joined into the reused SQL
fragments (column list, `?` placeholders, `excluded.<col>` upsert assignments,
`<col> = ?` update assignments). The four write statements embed those fragments so
each write carries every promoted column in `INDEXED_FIELDS` order.
`indexColumnValues` projects an `extractIndexColumns` result into that same order,
guaranteeing the bound-parameter order matches the SQL. `buildQueryBySql` takes a
pre-validated field subset and emits `SELECT value FROM kv WHERE collection = ?`
plus one quoted `AND "<field>" = ?` per filter, `ORDER BY id ASC`, and an optional
`LIMIT ?`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT interpolate a caller-supplied field into `buildQueryBySql` without the
  adapter first validating it against `INDEXED_FIELDS`; column names are quoted, not
  bound.
- ❌ Do NOT interpolate filter *values* — they are always bound parameters at the
  adapter.
- ❌ Do NOT reorder the column fragments independently of `indexColumnValues`; both
  derive from `INDEXED_FIELDS` order and must stay in lockstep.

## Grill Log

- **Q:** Why a separate module rather than inlining the SQL in [[sqlite-store]]?
  **A:** The adapter was at the 500-line cap; the SQL derived from `INDEXED_FIELDS`
  is a self-contained, handle-free unit, so extracting it is the cleanest way under
  the cap and colocates every place the column order matters. _Rejected:_ splitting
  by write-vs-read or growing the adapter past the cap.
- **Q:** Is interpolating field names into SQL an injection risk? **A:** No — the
  only interpolated names come from the `INDEXED_FIELDS` constant (write SQL) or a
  subset the adapter has already checked against it (`queryBy`); every value is a
  bound parameter. A caller can never introduce an arbitrary identifier.

## Referenced by

[[storage-index]] · [[sqlite-store]] · [[index-columns]] · [[Storage]]
