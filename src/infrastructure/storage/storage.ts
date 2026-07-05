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
  readonly list: (
    collection: string,
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
