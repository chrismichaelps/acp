/** @Acp.Infra.Events.PgNotifyBroker — Postgres LISTEN/NOTIFY event fan-out */
import { PgClient } from '@effect/sql-pg'
import {
  Chunk,
  Effect,
  Layer,
  Option,
  Redacted,
  Stream,
  type Scope,
} from 'effect'
import { EventBroker, type EventBrokerApi } from '../../domain/events/index.js'
import { StorageError } from '../../protocol/errors/protocol-error.js'
import { Storage } from '../storage/index.js'
import type { Event } from '../../protocol/schema/index.js'

const channel = 'acp_events'

interface EventPointer {
  readonly workspace_id: string
  readonly seq: number
}

const isEventPointer = (value: unknown): value is EventPointer => {
  const candidate = value as Partial<Record<keyof EventPointer, unknown>>
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof candidate.workspace_id === 'string' &&
    Number.isSafeInteger(candidate.seq) &&
    Number(candidate.seq) > 0
  )
}

const parsePointer = (payload: string): Effect.Effect<EventPointer, Error> =>
  Effect.try({
    try: () => JSON.parse(payload) as unknown,
    catch: (cause) => new Error(`invalid pg-notify payload: ${String(cause)}`),
  }).pipe(
    Effect.flatMap((value) =>
      isEventPointer(value)
        ? Effect.succeed({ workspace_id: value.workspace_id, seq: value.seq })
        : Effect.fail(new Error('invalid pg-notify event pointer')),
    ),
  )

const make = Effect.gen(function* () {
  const pg = yield* PgClient.PgClient
  const storage = yield* Storage

  const publish: EventBrokerApi['publish'] = (event) =>
    pg`SELECT pg_notify(${channel}, ${JSON.stringify({
      workspace_id: event.workspace_id,
      seq: event.seq,
    })})`.pipe(
      Effect.asVoid,
      Effect.catchAllCause((cause) =>
        Effect.logWarning('pg-notify publish failed', cause).pipe(
          Effect.annotateLogs({
            component: 'pg-notify-event-broker',
            workspace_id: event.workspace_id,
            seq: event.seq,
          }),
        ),
      ),
    )

  const eventForPointer = (
    pointer: EventPointer,
  ): Effect.Effect<Option.Option<Event>, StorageError> =>
    storage
      .readEventsAfter(pointer.workspace_id, pointer.seq - 1)
      .pipe(
        Effect.map((events) =>
          Chunk.findFirst(events, (event) => event.seq === pointer.seq),
        ),
      )

  const subscribe: EventBrokerApi['subscribe'] = (): Effect.Effect<
    Stream.Stream<Event>,
    never,
    Scope.Scope
  > =>
    Effect.succeed(
      pg.listen(channel).pipe(
        Stream.mapEffect((payload) =>
          parsePointer(payload).pipe(
            Effect.flatMap(eventForPointer),
            Effect.catchAllCause((cause) =>
              Effect.logWarning('pg-notify event lookup failed', cause).pipe(
                Effect.annotateLogs({
                  component: 'pg-notify-event-broker',
                }),
                Effect.as(Option.none<Event>()),
              ),
            ),
          ),
        ),
        Stream.catchAll((error) =>
          Stream.fromEffect(
            Effect.logError('pg-notify listener failed', error).pipe(
              Effect.annotateLogs({ component: 'pg-notify-event-broker' }),
            ),
          ).pipe(Stream.drain),
        ),
        Stream.filterMap((event) => event),
      ),
    )

  return { publish, subscribe } satisfies EventBrokerApi
})

export const makePgNotifyEventBrokerLive = (
  url: string,
): Layer.Layer<EventBroker, StorageError, Storage> =>
  Layer.scoped(EventBroker, make).pipe(
    Layer.provide(PgClient.layer({ url: Redacted.make(url) })),
    Layer.mapError(
      (cause) => new StorageError({ op: 'connect', cause: String(cause) }),
    ),
  )
