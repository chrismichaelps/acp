/** @Acp.Infra.Storage.Port — persistence seam interface */
import { Context } from 'effect'
import type { Chunk, Effect, Option } from 'effect'
import type {
  Event,
  Memory,
  ReadMemoryQuery,
} from '../../protocol/schema/index.js'
import type { StorageError } from '../../protocol/errors/protocol-error.js'

/** An Event with everything but its monotonic `seq`, which Storage assigns. */
export type EventDraft = Omit<Event, 'seq'>
/** A Memory record with everything but its monotonic `seq`, assigned by Storage. */
export type MemoryDraft = Omit<Memory, 'seq'>

/** A kv row's value paired with its per-row monotonic version counter. */
export interface StoredRecord {
  readonly value: unknown
  readonly version: number
}

/** An equality predicate over one promoted, indexed scoping column. */
export interface QueryFilter {
  readonly field: string
  readonly value: string
}

export interface StorageApi {
  readonly put: (
    collection: string,
    id: string,
    value: unknown,
  ) => Effect.Effect<void, StorageError>
  readonly putIfAbsent: (
    collection: string,
    id: string,
    value: unknown,
  ) => Effect.Effect<boolean, StorageError>
  readonly replaceIf: (
    collection: string,
    id: string,
    expected: unknown,
    value: unknown,
  ) => Effect.Effect<boolean, StorageError>
  readonly get: (
    collection: string,
    id: string,
  ) => Effect.Effect<Option.Option<unknown>, StorageError>
  /** Like `get`, but returns the row's version counter alongside its value. */
  readonly getVersioned: (
    collection: string,
    id: string,
  ) => Effect.Effect<Option.Option<StoredRecord>, StorageError>
  /**
   * Compare-and-swap on the row's version counter instead of its full
   * serialized value — O(1) vs. `replaceIf`'s whole-blob comparison. Swaps
   * and returns `true` only when the row's current version equals
   * `expectedVersion`; the new value's version is that plus one.
   */
  readonly replaceIfVersion: (
    collection: string,
    id: string,
    expectedVersion: number,
    value: unknown,
  ) => Effect.Effect<boolean, StorageError>
  readonly list: (
    collection: string,
  ) => Effect.Effect<Chunk.Chunk<unknown>, StorageError>
  /**
   * Scoped predicate read: returns decoded `value`s whose promoted, indexed
   * columns equal **every** supplied filter, ordered by `id`, with an optional
   * `limit`. Filter fields are restricted to the `INDEXED_FIELDS` allowlist —
   * an unknown field fails `StorageError`, guarding injection and index-miss.
   * Replaces the `list()` + in-app `.filter` pattern (O(N_all)) with an indexed
   * O(log N + k) read on the SQL adapters.
   */
  readonly queryBy: (
    collection: string,
    filters: readonly QueryFilter[],
    opts?: { readonly limit?: number },
  ) => Effect.Effect<Chunk.Chunk<unknown>, StorageError>
  readonly remove: (
    collection: string,
    id: string,
  ) => Effect.Effect<void, StorageError>
  readonly appendEvent: (
    workspaceId: string,
    draft: EventDraft,
  ) => Effect.Effect<Event, StorageError>
  readonly readEventsAfter: (
    workspaceId: string,
    afterSeq: number,
    limit?: Option.Option<number>,
  ) => Effect.Effect<Chunk.Chunk<Event>, StorageError>
  /**
   * Delete events whose `timestamp` is strictly before `cutoff` (an ISO-8601
   * UTC instant), returning how many were removed. The newest event per
   * workspace (highest `seq`) is always retained so the append `seq`
   * high-water-mark never resets — see [[ADR-0008-deployment-storage-topology]].
   */
  readonly pruneEventsBefore: (
    cutoff: string,
  ) => Effect.Effect<number, StorageError>
  readonly appendMemory: (
    workspaceId: string,
    draft: MemoryDraft,
  ) => Effect.Effect<Memory, StorageError>
  readonly readMemory: (
    query: ReadMemoryQuery,
  ) => Effect.Effect<Chunk.Chunk<Memory>, StorageError>
}

export class Storage extends Context.Tag('Storage')<Storage, StorageApi>() {}
