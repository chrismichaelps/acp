/** @Acp.Infra.Storage.Sqlite — file-backed SQLite adapter */
import { DatabaseSync } from 'node:sqlite'
import { Chunk, Effect, Layer, Option, Schema } from 'effect'
import { StorageError } from '../../protocol/errors/protocol-error.js'
import { Event, Memory } from '../../protocol/schema/index.js'
import { Storage } from './storage.js'
import type { StorageApi } from './storage.js'

interface JsonRow {
  readonly value: string
}

interface SeqRow {
  readonly seq: number
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

const toCause = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

const storageTry = <A>(op: string, body: () => A) =>
  Effect.try({
    try: body,
    catch: (cause) => new StorageError({ op, cause: toCause(cause) }),
  })

const parseJson = (op: string, text: string) =>
  storageTry(op, () => JSON.parse(text) as unknown)

const encodeJson = (op: string, value: unknown) =>
  storageTry(op, () => JSON.stringify(value))

const jsonRow = (
  row: Record<string, unknown> | undefined,
): Option.Option<JsonRow> =>
  row === undefined || typeof row.value !== 'string'
    ? Option.none()
    : Option.some({ value: row.value })

const jsonRows = (
  rows: readonly Record<string, unknown>[],
): readonly JsonRow[] =>
  rows.flatMap((row) =>
    typeof row.value === 'string' ? [{ value: row.value }] : [],
  )

const seqRow = (row: Record<string, unknown> | undefined): SeqRow =>
  row !== undefined && typeof row.seq === 'number'
    ? { seq: row.seq }
    : { seq: 0 }

const decodeEvent = (op: string, value: unknown) =>
  Schema.decodeUnknown(Event)(value).pipe(
    Effect.mapError((cause) => new StorageError({ op, cause: String(cause) })),
  )

const decodeMemory = (op: string, value: unknown) =>
  Schema.decodeUnknown(Memory)(value).pipe(
    Effect.mapError((cause) => new StorageError({ op, cause: String(cause) })),
  )

const optionalText = <A>(option: Option.Option<A>): A | null =>
  Option.match(option, {
    onNone: () => null,
    onSome: (value) => value,
  })

const memoryMatchesSecondaryFilters = (
  memory: Memory,
  query: Parameters<StorageApi['readMemory']>[0],
) =>
  Option.match(query.kind, {
    onNone: () => true,
    onSome: (kind) => memory.kind === kind,
  }) &&
  Option.match(query.label, {
    onNone: () => true,
    onSome: (label) => memory.labels.includes(label),
  })

const memoryRowsToChunk = (
  rows: readonly JsonRow[],
  query: Parameters<StorageApi['readMemory']>[0],
) =>
  Effect.gen(function* () {
    const limit = Option.getOrElse(query.limit, () => 100)
    const decoded = yield* Effect.forEach(rows, (row) =>
      Effect.flatMap(parseJson('decode_memory_json', row.value), (value) =>
        decodeMemory('decode_memory', value),
      ),
    )
    return Chunk.fromIterable(
      decoded.filter((memory) => memoryMatchesSecondaryFilters(memory, query)),
    ).pipe(Chunk.take(limit))
  })

const rollback = (db: DatabaseSync) => {
  try {
    db.exec('ROLLBACK')
  } catch {
    // Ignore rollback failures so the original SQLite/encoding error is preserved.
  }
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
        return opened
      }),
      (opened) =>
        Effect.sync(() => {
          opened.close()
        }),
    )

    const putStmt = db.prepare(
      `INSERT INTO kv (collection, id, value)
       VALUES (?, ?, ?)
       ON CONFLICT(collection, id) DO UPDATE SET value = excluded.value`,
    )
    const getStmt = db.prepare(
      'SELECT value FROM kv WHERE collection = ? AND id = ?',
    )
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
       ORDER BY seq ASC`,
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
        yield* storageTry('put', () => putStmt.run(collection, id, encoded))
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

    const readEventsAfter: StorageApi['readEventsAfter'] = (
      workspaceId,
      afterSeq,
    ) =>
      Effect.gen(function* () {
        const rows = yield* storageTry('read_events_after', () =>
          jsonRows(readEventsAfterStmt.all(workspaceId, afterSeq)),
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
      get,
      list,
      remove,
      appendEvent,
      readEventsAfter,
      appendMemory,
      readMemory,
    } satisfies StorageApi
  })

export const makeSqliteStorageLive = (
  path: string,
): Layer.Layer<Storage, StorageError> => Layer.scoped(Storage, make(path))

export const SqliteMemoryStorageLive: Layer.Layer<Storage, StorageError> =
  makeSqliteStorageLive(':memory:')
