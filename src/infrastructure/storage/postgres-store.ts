/** @Acp.Infra.Storage.Postgres — network-durable Postgres adapter (@effect/sql-pg) */
import { SqlClient } from '@effect/sql'
import { PgClient } from '@effect/sql-pg'
import { Chunk, Effect, Layer, Option, Redacted, Schema } from 'effect'
import { StorageError } from '../../protocol/errors/protocol-error.js'
import { Event, Memory } from '../../protocol/schema/index.js'
import { Storage } from './storage.js'
import { INDEXED_FIELDS } from './index-columns.js'
import type { StorageApi, StoredRecord } from './storage.js'

const INDEXED_FIELD_SET: ReadonlySet<string> = new Set(INDEXED_FIELDS)

// Promoted scoping columns are DB-derived: Postgres computes each from the jsonb
// value via a STORED generated column, so no write path changes — every insert or
// update recomputes them automatically, and they can never drift from `value`.
const generatedColumnStatements: readonly string[] = INDEXED_FIELDS.map(
  (field) =>
    `ALTER TABLE kv ADD COLUMN IF NOT EXISTS ${field} text ` +
    `GENERATED ALWAYS AS (value->>'${field}') STORED`,
)

const schemaStatements: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS kv (
    collection text NOT NULL,
    id text NOT NULL,
    value jsonb NOT NULL,
    PRIMARY KEY (collection, id)
  )`,
  `ALTER TABLE kv ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1`,
  ...generatedColumnStatements,
  `CREATE INDEX IF NOT EXISTS kv_collection_workspace
     ON kv (collection, workspace_id)`,
  `CREATE INDEX IF NOT EXISTS kv_collection_workspace_state
     ON kv (collection, workspace_id, state)`,
  `CREATE INDEX IF NOT EXISTS kv_collection_work
     ON kv (collection, work_id)`,
  `CREATE TABLE IF NOT EXISTS events (
    workspace_id text NOT NULL,
    seq bigint NOT NULL,
    value jsonb NOT NULL,
    PRIMARY KEY (workspace_id, seq)
  )`,
  `CREATE TABLE IF NOT EXISTS event_seq (
    workspace_id text PRIMARY KEY,
    next_seq bigint NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS memory (
    workspace_id text NOT NULL,
    seq bigint NOT NULL,
    id text NOT NULL,
    work_id text,
    kind text NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL,
    created_at text NOT NULL,
    PRIMARY KEY (workspace_id, seq),
    UNIQUE (workspace_id, id)
  )`,
  `CREATE TABLE IF NOT EXISTS memory_seq (
    workspace_id text PRIMARY KEY,
    next_seq bigint NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS memory_ws_key_seq ON memory (workspace_id, key, seq)`,
  `CREATE INDEX IF NOT EXISTS memory_ws_work_seq ON memory (workspace_id, work_id, seq)`,
]

interface ValueRow {
  readonly value: unknown
}

interface VersionedRow {
  readonly value: unknown
  readonly version: string | number
}

const storageError = (op: string) => (cause: unknown) =>
  new StorageError({ op, cause: String(cause) })

const decodeEvent = (op: string, value: unknown) =>
  Schema.decodeUnknown(Event)(value).pipe(Effect.mapError(storageError(op)))

const decodeMemory = (op: string, value: unknown) =>
  Schema.decodeUnknown(Memory)(value).pipe(Effect.mapError(storageError(op)))

const optionalText = <A>(option: Option.Option<A>): A | null =>
  Option.getOrNull(option)

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

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* Effect.forEach(schemaStatements, (statement) =>
    sql.unsafe(statement),
  ).pipe(Effect.mapError(storageError('migrate')))

  const put: StorageApi['put'] = (collection, id, value) =>
    sql`INSERT INTO kv (collection, id, value)
        VALUES (${collection}, ${id}, ${JSON.stringify(value)}::jsonb)
        ON CONFLICT (collection, id) DO UPDATE SET value = excluded.value, version = kv.version + 1`.pipe(
      Effect.asVoid,
      Effect.mapError(storageError('put')),
    )

  const replaceIf: StorageApi['replaceIf'] = (
    collection,
    id,
    expected,
    value,
  ) =>
    sql<{ readonly one: number }>`
      UPDATE kv
      SET value = ${JSON.stringify(value)}::jsonb, version = kv.version + 1
      WHERE collection = ${collection}
        AND id = ${id}
        AND value = ${JSON.stringify(expected)}::jsonb
      RETURNING 1 AS one`.pipe(
      Effect.map((rows) => rows.length === 1),
      Effect.mapError(storageError('replace_if')),
    )

  const replaceIfVersion: StorageApi['replaceIfVersion'] = (
    collection,
    id,
    expectedVersion,
    value,
  ) =>
    sql<{ readonly one: number }>`
      UPDATE kv
      SET value = ${JSON.stringify(value)}::jsonb, version = version + 1
      WHERE collection = ${collection}
        AND id = ${id}
        AND version = ${expectedVersion}
      RETURNING 1 AS one`.pipe(
      Effect.map((rows) => rows.length === 1),
      Effect.mapError(storageError('replace_if_version')),
    )

  const putIfAbsent: StorageApi['putIfAbsent'] = (collection, id, value) =>
    sql<{ readonly one: number }>`
      INSERT INTO kv (collection, id, value)
      VALUES (${collection}, ${id}, ${JSON.stringify(value)}::jsonb)
      ON CONFLICT (collection, id) DO NOTHING
      RETURNING 1 AS one`.pipe(
      Effect.map((rows) => rows.length === 1),
      Effect.mapError(storageError('put_if_absent')),
    )

  const get: StorageApi['get'] = (collection, id) =>
    sql<ValueRow>`SELECT value FROM kv WHERE collection = ${collection} AND id = ${id}`.pipe(
      Effect.map((rows) =>
        rows.length === 0 ? Option.none<unknown>() : Option.some(rows[0].value),
      ),
      Effect.mapError(storageError('get')),
    )

  const getVersioned: StorageApi['getVersioned'] = (collection, id) =>
    sql<VersionedRow>`SELECT value, version FROM kv WHERE collection = ${collection} AND id = ${id}`.pipe(
      Effect.map((rows) =>
        rows.length === 0
          ? Option.none<StoredRecord>()
          : Option.some({
              value: rows[0].value,
              version: Number(rows[0].version),
            }),
      ),
      Effect.mapError(storageError('get_versioned')),
    )

  const list: StorageApi['list'] = (collection) =>
    sql<ValueRow>`SELECT value FROM kv WHERE collection = ${collection} ORDER BY id ASC`.pipe(
      Effect.map((rows) => Chunk.fromIterable(rows.map((row) => row.value))),
      Effect.mapError(storageError('list')),
    )

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
      // Column names come only from the validated allowlist (rendered as quoted
      // identifiers via sql(field)); every filter value is a bound parameter.
      const conditions = [
        sql`collection = ${collection}`,
        ...filters.map((f) => sql`${sql(f.field)} = ${f.value}`),
      ]
      const limit = opts?.limit
      const rows = yield* sql<ValueRow>`
        SELECT value FROM kv
        WHERE ${sql.and(conditions)}
        ORDER BY id ASC
        ${limit === undefined ? sql`` : sql`LIMIT ${limit}`}`.pipe(
        Effect.mapError(storageError('query_by')),
      )
      return Chunk.fromIterable(rows.map((row) => row.value))
    })

  const remove: StorageApi['remove'] = (collection, id) =>
    sql`DELETE FROM kv WHERE collection = ${collection} AND id = ${id}`.pipe(
      Effect.asVoid,
      Effect.mapError(storageError('remove')),
    )

  const appendEvent: StorageApi['appendEvent'] = (workspaceId, draft) =>
    sql
      .withTransaction(
        Effect.gen(function* () {
          const seqRows = yield* sql<{ readonly seq: string }>`
            INSERT INTO event_seq (workspace_id, next_seq) VALUES (${workspaceId}, 2)
            ON CONFLICT (workspace_id) DO UPDATE SET next_seq = event_seq.next_seq + 1
            RETURNING next_seq - 1 AS seq`
          const event: Event = { ...draft, seq: Number(seqRows[0].seq) }
          const encoded = JSON.stringify(Schema.encodeSync(Event)(event))
          yield* sql`INSERT INTO events (workspace_id, seq, value)
                     VALUES (${workspaceId}, ${event.seq}, ${encoded}::jsonb)`
          return event
        }),
      )
      .pipe(Effect.mapError(storageError('append_event')))

  const readEventsAfter: StorageApi['readEventsAfter'] = (
    workspaceId,
    afterSeq,
    limit,
  ) =>
    Effect.sync(() =>
      Option.getOrElse(limit ?? Option.none(), () => Number.MAX_SAFE_INTEGER),
    ).pipe(
      Effect.flatMap(
        (rowLimit) =>
          sql<ValueRow>`SELECT value FROM events
                      WHERE workspace_id = ${workspaceId} AND seq > ${afterSeq}
                      ORDER BY seq ASC
                      LIMIT ${rowLimit}`,
      ),
      Effect.mapError(storageError('read_events_after')),
      Effect.flatMap((rows) =>
        Effect.forEach(rows, (row) => decodeEvent('decode_event', row.value)),
      ),
      Effect.map(Chunk.fromIterable),
    )

  const pruneEventsBefore: StorageApi['pruneEventsBefore'] = (cutoff) =>
    sql<{ readonly one: number }>`
      DELETE FROM events
      WHERE (value->>'timestamp') < ${cutoff}
        AND seq < (
          SELECT MAX(seq) FROM events AS newest
          WHERE newest.workspace_id = events.workspace_id
        )
      RETURNING 1 AS one`.pipe(
      Effect.map((rows) => rows.length),
      Effect.mapError(storageError('prune_events_before')),
    )

  const appendMemory: StorageApi['appendMemory'] = (workspaceId, draft) =>
    sql
      .withTransaction(
        Effect.gen(function* () {
          const seqRows = yield* sql<{ readonly seq: string }>`
            INSERT INTO memory_seq (workspace_id, next_seq) VALUES (${workspaceId}, 2)
            ON CONFLICT (workspace_id) DO UPDATE SET next_seq = memory_seq.next_seq + 1
            RETURNING next_seq - 1 AS seq`
          const memory: Memory = { ...draft, seq: Number(seqRows[0].seq) }
          const encoded = JSON.stringify(Schema.encodeSync(Memory)(memory))
          yield* sql`INSERT INTO memory
                     (workspace_id, seq, id, work_id, kind, key, value, created_at)
                     VALUES (${workspaceId}, ${memory.seq}, ${memory.id},
                             ${optionalText(memory.work_id)}, ${memory.kind},
                             ${memory.key}, ${encoded}::jsonb, ${memory.created_at})`
          return memory
        }),
      )
      .pipe(Effect.mapError(storageError('append_memory')))

  const readMemory: StorageApi['readMemory'] = (query) =>
    Effect.gen(function* () {
      const limit = Option.getOrElse(query.limit, () => 100)
      const key = optionalText(query.key)
      const workId = optionalText(query.work_id)
      const rows = yield* sql<ValueRow>`
        SELECT value FROM memory
        WHERE workspace_id = ${query.workspace_id}
          AND seq > ${query.after_seq}
          ${workId === null ? sql`` : sql`AND work_id = ${workId}`}
          ${key === null ? sql`` : sql`AND key = ${key}`}
        ORDER BY seq ASC
        LIMIT ${limit}`.pipe(Effect.mapError(storageError('read_memory')))
      const decoded = yield* Effect.forEach(rows, (row) =>
        decodeMemory('decode_memory', row.value),
      )
      return Chunk.fromIterable(
        decoded.filter((memory) =>
          memoryMatchesSecondaryFilters(memory, query),
        ),
      )
    })

  return {
    put,
    putIfAbsent,
    replaceIf,
    replaceIfVersion,
    get,
    getVersioned,
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

/**
 * Build a {@link Storage} layer backed by Postgres via `@effect/sql-pg`. The
 * `PgClient` layer provides connection pooling and bundles its `Reactivity`
 * dependency, so the residual requirement is only the connection URL.
 */
export const makePostgresStorageLive = (
  url: string,
): Layer.Layer<Storage, StorageError> =>
  Layer.scoped(Storage, make).pipe(
    Layer.provide(PgClient.layer({ url: Redacted.make(url) })),
    Layer.mapError(
      (cause) => new StorageError({ op: 'connect', cause: String(cause) }),
    ),
  )
