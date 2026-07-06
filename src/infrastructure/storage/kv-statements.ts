/** @Acp.Infra.Storage.KvStatements — kv DDL + statement SQL derived from INDEXED_FIELDS */
import { INDEXED_FIELDS, type IndexedField } from './index-columns.js'

// The promoted-column set is fixed at module load, so every statement's column
// list is built once here rather than per write. Column names come only from the
// INDEXED_FIELDS allowlist, never caller input — safe to interpolate into SQL.
const cols = INDEXED_FIELDS
const colList = cols.join(', ')
const colPlaceholders = cols.map(() => '?').join(', ')
const colExcluded = cols.map((f) => `${f} = excluded.${f}`).join(', ')
const colAssign = cols.map((f) => `${f} = ?`).join(', ')

export const putSql = `INSERT INTO kv (collection, id, value, version, ${colList})
   VALUES (?, ?, ?, 1, ${colPlaceholders})
   ON CONFLICT(collection, id)
   DO UPDATE SET value = excluded.value, version = kv.version + 1, ${colExcluded}`

export const putIfAbsentSql = `INSERT OR IGNORE INTO kv (collection, id, value, version, ${colList})
   VALUES (?, ?, ?, 1, ${colPlaceholders})`

export const replaceIfSql = `UPDATE kv
   SET value = ?, version = version + 1, ${colAssign}
   WHERE collection = ? AND id = ? AND value = ?`

export const replaceIfVersionSql = `UPDATE kv
   SET value = ?, version = version + 1, ${colAssign}
   WHERE collection = ? AND id = ? AND version = ?`

/** Idempotent `ALTER TABLE kv ADD COLUMN` DDL, one per promoted field. */
export const indexColumnDdls: readonly { column: string; ddl: string }[] =
  cols.map((f) => ({ column: f, ddl: `ALTER TABLE kv ADD COLUMN ${f} TEXT` }))

/** Composite indexes covering the hottest scoped reads. */
export const kvIndexSql = `CREATE INDEX IF NOT EXISTS kv_collection_workspace
     ON kv (collection, workspace_id);
   CREATE INDEX IF NOT EXISTS kv_collection_workspace_state
     ON kv (collection, workspace_id, state);
   CREATE INDEX IF NOT EXISTS kv_collection_work
     ON kv (collection, work_id);`

/** Promoted-column values in INDEXED_FIELDS order — matches the write SQL. */
export const indexColumnValues = (
  columns: Record<IndexedField, string | null>,
): (string | null)[] => cols.map((f) => columns[f])

/**
 * Build the `queryBy` SELECT. `fields` must be pre-validated against
 * INDEXED_FIELDS by the caller — they are quoted into the SQL, values stay bound.
 */
export const buildQueryBySql = (
  fields: readonly string[],
  hasLimit: boolean,
): string => {
  const predicates = fields.map((f) => ` AND "${f}" = ?`).join('')
  return `SELECT value FROM kv WHERE collection = ?${predicates} ORDER BY id ASC${
    hasLimit ? ' LIMIT ?' : ''
  }`
}
