/** @Acp.Infra.Storage.SqliteSupport — pure serialization + row-mapping helpers for the SQLite adapter */
import { Chunk, Effect, Option, Schema } from 'effect'
import { StorageError } from '../../protocol/errors/protocol-error.js'
import { Event, Memory } from '../../protocol/schema/index.js'
import type { DatabaseSync } from 'node:sqlite'
import type { StorageApi } from './storage.js'

export interface JsonRow {
  readonly value: string
}

export interface SeqRow {
  readonly seq: number
}

export const toCause = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

export const storageTry = <A>(op: string, body: () => A) =>
  Effect.try({
    try: body,
    catch: (cause) => new StorageError({ op, cause: toCause(cause) }),
  })

export const parseJson = (op: string, text: string) =>
  storageTry(op, () => JSON.parse(text) as unknown)

export const encodeJson = (op: string, value: unknown) =>
  storageTry(op, () => JSON.stringify(value))

export const jsonRow = (
  row: Record<string, unknown> | undefined,
): Option.Option<JsonRow> =>
  row === undefined || typeof row.value !== 'string'
    ? Option.none()
    : Option.some({ value: row.value })

export const jsonRows = (
  rows: readonly Record<string, unknown>[],
): readonly JsonRow[] =>
  rows.flatMap((row) =>
    typeof row.value === 'string' ? [{ value: row.value }] : [],
  )

export const seqRow = (row: Record<string, unknown> | undefined): SeqRow =>
  row !== undefined && typeof row.seq === 'number'
    ? { seq: row.seq }
    : { seq: 0 }

export const decodeEvent = (op: string, value: unknown) =>
  Schema.decodeUnknown(Event)(value).pipe(
    Effect.mapError((cause) => new StorageError({ op, cause: String(cause) })),
  )

export const decodeMemory = (op: string, value: unknown) =>
  Schema.decodeUnknown(Memory)(value).pipe(
    Effect.mapError((cause) => new StorageError({ op, cause: String(cause) })),
  )

export const optionalText = <A>(option: Option.Option<A>): A | null =>
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

export const memoryRowsToChunk = (
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

export const rollback = (db: DatabaseSync) => {
  try {
    db.exec('ROLLBACK')
  } catch {
    // Ignore rollback failures so the original SQLite/encoding error is preserved.
  }
}
