/** @Acp.Infra.Storage.Sqlite — file-backed SQLite adapter */
import { DatabaseSync } from 'node:sqlite'
import { Chunk, Effect, Layer, Option, Schema } from 'effect'
import { Event, Memory } from '../../protocol/schema/index.js'
import { Storage } from './storage.js'
import {
  decodeEvent,
  encodeJson,
  jsonRow,
  jsonRows,
  memoryRowsToChunk,
  optionalText,
  parseJson,
  rollback,
  seqRow,
  storageTry,
} from './sqlite-support.js'
import { extractIndexColumns, INDEXED_FIELDS } from './index-columns.js'
import {
  buildQueryBySql,
  indexColumnDdls,
  indexColumnValues,
  kvIndexSql,
  putIfAbsentSql,
  putSql,
  replaceIfSql,
  replaceIfVersionSql,
} from './kv-statements.js'
import { StorageError } from '../../protocol/errors/protocol-error.js'
import type { StorageApi, StoredRecord } from './storage.js'

const INDEXED_FIELD_SET: ReadonlySet<string> = new Set(INDEXED_FIELDS)

interface VersionedRow {
  readonly value: string
  readonly version: number
}

const schemaSql = `
CREATE TABLE IF NOT EXISTS kv (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (collection, id)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS events (
  workspace_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (workspace_id, seq)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS memory (
  workspace_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  id TEXT NOT NULL,
  work_id TEXT,
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  labels_json TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, seq),
  UNIQUE (workspace_id, id)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS memory_workspace_key_seq
  ON memory (workspace_id, key, seq);

CREATE INDEX IF NOT EXISTS memory_workspace_work_seq
  ON memory (workspace_id, work_id, seq);
`

const versionedRow = (
  row: Record<string, unknown> | undefined,
): Option.Option<VersionedRow> =>
  row === undefined ||
  typeof row.value !== 'string' ||
  typeof row.version !== 'number'
    ? Option.none()
    : Option.some({ value: row.value, version: row.version })

const ensureColumn = (
  db: DatabaseSync,
  table: string,
  column: string,
  ddl: string,
) => {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string
  }[]
  if (!cols.some((c) => c.name === column)) db.exec(ddl)
}

const make = (path: string) =>
  Effect.gen(function* () {
    const db = yield* Effect.acquireRelease(
      storageTry('open_sqlite', () => {
        const opened = new DatabaseSync(path)
        opened.exec('PRAGMA busy_timeout = 5000')
        opened.exec('PRAGMA journal_mode = WAL')
        opened.exec('PRAGMA synchronous = NORMAL')
        opened.exec(schemaSql)
        ensureColumn(
          opened,
          'kv',
          'version',
          'ALTER TABLE kv ADD COLUMN version INTEGER NOT NULL DEFAULT 1',
        )
        for (const { column, ddl } of indexColumnDdls) {
          ensureColumn(opened, 'kv', column, ddl)
        }
        opened.exec(kvIndexSql)
        return opened
      }),
      (opened) =>
        Effect.sync(() => {
          opened.close()
        }),
    )

    const putStmt = db.prepare(putSql)
    const putIfAbsentStmt = db.prepare(putIfAbsentSql)
    const replaceIfStmt = db.prepare(replaceIfSql)
    const getStmt = db.prepare(
      'SELECT value FROM kv WHERE collection = ? AND id = ?',
    )
    const getVersionedStmt = db.prepare(
      'SELECT value, version FROM kv WHERE collection = ? AND id = ?',
    )
    const replaceIfVersionStmt = db.prepare(replaceIfVersionSql)
    const listStmt = db.prepare(
      'SELECT value FROM kv WHERE collection = ? ORDER BY id ASC',
    )
    const removeStmt = db.prepare(
      'DELETE FROM kv WHERE collection = ? AND id = ?',
    )
    const nextEventSeqStmt = db.prepare(
      'SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM events WHERE workspace_id = ?',
    )
    const appendEventStmt = db.prepare(
      'INSERT INTO events (workspace_id, seq, value) VALUES (?, ?, ?)',
    )
    const readEventsAfterStmt = db.prepare(
      `SELECT value FROM events
       WHERE workspace_id = ? AND seq > ?
       ORDER BY seq ASC
       LIMIT ?`,
    )
    // Delete aged events but never a workspace's newest row, so MAX(seq) — the
    // append high-water-mark — is preserved even after a full-history sweep.
    const pruneEventsStmt = db.prepare(
      `DELETE FROM events
       WHERE json_extract(value, '$.timestamp') < ?
         AND seq < (
           SELECT MAX(seq) FROM events AS newest
           WHERE newest.workspace_id = events.workspace_id
         )`,
    )
    const nextMemorySeqStmt = db.prepare(
      'SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM memory WHERE workspace_id = ?',
    )
    const appendMemoryStmt = db.prepare(
      `INSERT INTO memory
       (workspace_id, seq, id, work_id, kind, key, labels_json, value, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const readMemoryStmt = db.prepare(
      `SELECT value FROM memory
       WHERE workspace_id = ? AND seq > ?
       ORDER BY seq ASC
       LIMIT ?`,
    )
    const readMemoryByKeyStmt = db.prepare(
      `SELECT value FROM memory INDEXED BY memory_workspace_key_seq
       WHERE workspace_id = ? AND key = ? AND seq > ?
       ORDER BY seq ASC
       LIMIT ?`,
    )
    const readMemoryByWorkStmt = db.prepare(
      `SELECT value FROM memory INDEXED BY memory_workspace_work_seq
       WHERE workspace_id = ? AND work_id = ? AND seq > ?
       ORDER BY seq ASC
       LIMIT ?`,
    )
    const readMemoryByWorkAndKeyStmt = db.prepare(
      `SELECT value FROM memory INDEXED BY memory_workspace_work_seq
       WHERE workspace_id = ? AND work_id = ? AND key = ? AND seq > ?
       ORDER BY seq ASC
       LIMIT ?`,
    )

    const put: StorageApi['put'] = (collection, id, value) =>
      Effect.gen(function* () {
        const encoded = yield* encodeJson('encode_value', value)
        const columns = indexColumnValues(extractIndexColumns(value))
        yield* storageTry('put', () =>
          putStmt.run(collection, id, encoded, ...columns),
        )
      })

    const replaceIf: StorageApi['replaceIf'] = (
      collection,
      id,
      expected,
      value,
    ) =>
      Effect.gen(function* () {
        const encodedExpected = yield* encodeJson('encode_expected', expected)
        const encodedValue = yield* encodeJson('encode_value', value)
        const columns = indexColumnValues(extractIndexColumns(value))
        const changes = yield* storageTry('replace_if', () =>
          Number(
            replaceIfStmt.run(
              encodedValue,
              ...columns,
              collection,
              id,
              encodedExpected,
            ).changes,
          ),
        )
        return changes === 1
      })

    const replaceIfVersion: StorageApi['replaceIfVersion'] = (
      collection,
      id,
      expectedVersion,
      value,
    ) =>
      Effect.gen(function* () {
        const encoded = yield* encodeJson('encode_value', value)
        const columns = indexColumnValues(extractIndexColumns(value))
        const changes = yield* storageTry('replace_if_version', () =>
          Number(
            replaceIfVersionStmt.run(
              encoded,
              ...columns,
              collection,
              id,
              expectedVersion,
            ).changes,
          ),
        )
        return changes === 1
      })

    const putIfAbsent: StorageApi['putIfAbsent'] = (collection, id, value) =>
      Effect.gen(function* () {
        const encoded = yield* encodeJson('encode_value', value)
        const columns = indexColumnValues(extractIndexColumns(value))
        const changes = yield* storageTry('put_if_absent', () =>
          Number(
            putIfAbsentStmt.run(collection, id, encoded, ...columns).changes,
          ),
        )
        return changes === 1
      })

    const get: StorageApi['get'] = (collection, id) =>
      Effect.gen(function* () {
        const row = yield* storageTry('get', () =>
          jsonRow(getStmt.get(collection, id)),
        )
        return yield* Option.match(row, {
          onNone: () => Effect.succeed(Option.none<unknown>()),
          onSome: (found) =>
            Effect.map(parseJson('decode_value', found.value), Option.some),
        })
      })

    const getVersioned: StorageApi['getVersioned'] = (collection, id) =>
      Effect.gen(function* () {
        const row = yield* storageTry('get_versioned', () =>
          versionedRow(getVersionedStmt.get(collection, id)),
        )
        return yield* Option.match(row, {
          onNone: () => Effect.succeed(Option.none<StoredRecord>()),
          onSome: (found) =>
            Effect.map(
              parseJson('decode_value', found.value),
              (value): Option.Option<StoredRecord> =>
                Option.some({ value, version: found.version }),
            ),
        })
      })

    const list: StorageApi['list'] = (collection) =>
      Effect.gen(function* () {
        const rows = yield* storageTry('list', () =>
          jsonRows(listStmt.all(collection)),
        )
        const values = yield* Effect.forEach(rows, (row) =>
          parseJson('decode_value', row.value),
        )
        return Chunk.fromIterable(values)
      })

    const queryBy: StorageApi['queryBy'] = (collection, filters, opts) =>
      Effect.gen(function* () {
        for (const { field } of filters) {
          if (!INDEXED_FIELD_SET.has(field)) {
            return yield* Effect.fail(
              new StorageError({
                op: 'queryBy',
                cause: `unknown filter field: ${field}`,
              }),
            )
          }
        }
        const hasLimit = opts?.limit !== undefined
        const sql = buildQueryBySql(
          filters.map((f) => f.field),
          hasLimit,
        )
        const params: (string | number)[] = [
          collection,
          ...filters.map((f) => f.value),
        ]
        if (opts?.limit !== undefined) params.push(opts.limit)
        const rows = yield* storageTry('query_by', () =>
          jsonRows(db.prepare(sql).all(...params)),
        )
        const values = yield* Effect.forEach(rows, (row) =>
          parseJson('decode_value', row.value),
        )
        return Chunk.fromIterable(values)
      })

    const remove: StorageApi['remove'] = (collection, id) =>
      Effect.asVoid(storageTry('remove', () => removeStmt.run(collection, id)))

    const appendEvent: StorageApi['appendEvent'] = (workspaceId, draft) =>
      storageTry('append_event', () => {
        db.exec('BEGIN IMMEDIATE')
        try {
          const nextSeq = seqRow(nextEventSeqStmt.get(workspaceId)).seq
          const event: Event = { ...draft, seq: nextSeq }
          const encoded = JSON.stringify(Schema.encodeSync(Event)(event))
          appendEventStmt.run(workspaceId, nextSeq, encoded)
          db.exec('COMMIT')
          return event
        } catch (cause) {
          rollback(db)
          throw cause
        }
      })

    const pruneEventsBefore: StorageApi['pruneEventsBefore'] = (cutoff) =>
      storageTry('prune_events_before', () =>
        Number(pruneEventsStmt.run(cutoff).changes),
      )

    const readEventsAfter: StorageApi['readEventsAfter'] = (
      workspaceId,
      afterSeq,
      limit,
    ) =>
      Effect.gen(function* () {
        const rowLimit = Option.getOrElse(
          limit ?? Option.none(),
          () => Number.MAX_SAFE_INTEGER,
        )
        const rows = yield* storageTry('read_events_after', () =>
          jsonRows(readEventsAfterStmt.all(workspaceId, afterSeq, rowLimit)),
        )
        const events = yield* Effect.forEach(rows, (row) =>
          Effect.flatMap(parseJson('decode_event_json', row.value), (value) =>
            decodeEvent('decode_event', value),
          ),
        )
        return Chunk.fromIterable(events)
      })

    const appendMemory: StorageApi['appendMemory'] = (workspaceId, draft) =>
      storageTry('append_memory', () => {
        db.exec('BEGIN IMMEDIATE')
        try {
          const nextSeq = seqRow(nextMemorySeqStmt.get(workspaceId)).seq
          const memory: Memory = { ...draft, seq: nextSeq }
          const encoded = JSON.stringify(Schema.encodeSync(Memory)(memory))
          appendMemoryStmt.run(
            workspaceId,
            nextSeq,
            memory.id,
            optionalText(memory.work_id),
            memory.kind,
            memory.key,
            JSON.stringify(memory.labels),
            encoded,
            memory.created_at,
          )
          db.exec('COMMIT')
          return memory
        } catch (cause) {
          rollback(db)
          throw cause
        }
      })

    const readMemory: StorageApi['readMemory'] = (query) =>
      Effect.gen(function* () {
        const limit = Option.getOrElse(query.limit, () => 100)
        const key = optionalText(query.key)
        const workId = optionalText(query.work_id)
        const rows = yield* storageTry('read_memory', () => {
          if (workId !== null && key !== null) {
            return jsonRows(
              readMemoryByWorkAndKeyStmt.all(
                query.workspace_id,
                workId,
                key,
                query.after_seq,
                limit,
              ),
            )
          }
          if (workId !== null) {
            return jsonRows(
              readMemoryByWorkStmt.all(
                query.workspace_id,
                workId,
                query.after_seq,
                limit,
              ),
            )
          }
          if (key !== null) {
            return jsonRows(
              readMemoryByKeyStmt.all(
                query.workspace_id,
                key,
                query.after_seq,
                limit,
              ),
            )
          }
          return jsonRows(
            readMemoryStmt.all(query.workspace_id, query.after_seq, limit),
          )
        })
        return yield* memoryRowsToChunk(rows, query)
      })

    return {
      put,
      putIfAbsent,
      replaceIf,
      get,
      getVersioned,
      replaceIfVersion,
      list,
      queryBy,
      remove,
      appendEvent,
      readEventsAfter,
      pruneEventsBefore,
      appendMemory,
      readMemory,
    } satisfies StorageApi
  })

export const makeSqliteStorageLive = (
  path: string,
): Layer.Layer<Storage, StorageError> => Layer.scoped(Storage, make(path))

export const SqliteMemoryStorageLive: Layer.Layer<Storage, StorageError> =
  makeSqliteStorageLive(':memory:')
