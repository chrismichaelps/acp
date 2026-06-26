/** @Acp.Infra.Storage.Port — persistence seam interface */
import { Context } from 'effect'
import type { Chunk, Effect, Option } from 'effect'
import type { Event } from '../../protocol/schema/index.js'
import type { StorageError } from '../../protocol/errors/protocol-error.js'

/** An Event with everything but its monotonic `seq`, which Storage assigns. */
export type EventDraft = Omit<Event, 'seq'>

export interface StorageApi {
  readonly put: (
    collection: string,
    id: string,
    value: unknown,
  ) => Effect.Effect<void, StorageError>
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
}

export class Storage extends Context.Tag('Storage')<Storage, StorageApi>() {}
