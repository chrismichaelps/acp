/** @Acp.Infra.Sse.EventStream — EventStore stream to Server-Sent Events */
import { HttpServerResponse } from '@effect/platform'
import { Chunk, Data, Effect, Schema, Stream } from 'effect'
import type { Duration, Scope } from 'effect'
import { AppConfigTag } from '../../config/app-config.js'
import { EventStore } from '../../domain/events/index.js'
import { Event } from '../../protocol/schema/index.js'
import type { Event as EventModel } from '../../protocol/schema/index.js'

export class SseEncodeError extends Data.TaggedError('SseEncodeError')<{
  readonly cause: string
}> {}

export const sseContentType = 'text/event-stream'
export const heartbeatFrame = ': heartbeat\n\n'

const sseHeaders = {
  'cache-control': 'no-cache',
  connection: 'keep-alive',
} as const

export const encodeSseEventFrame = (
  event: EventModel,
): Effect.Effect<string, SseEncodeError> =>
  Schema.encode(Event)(event).pipe(
    Effect.mapError((error) => new SseEncodeError({ cause: String(error) })),
    Effect.map(
      (encoded) => `event: ${event.type}\ndata: ${JSON.stringify(encoded)}\n\n`,
    ),
  )

export const eventsToSseText = <E, R>(
  events: Stream.Stream<EventModel, E, R>,
): Stream.Stream<string, E | SseEncodeError, R> =>
  events.pipe(Stream.mapEffect(encodeSseEventFrame))

export const eventsToSseBytes = <E, R>(
  events: Stream.Stream<EventModel, E, R>,
): Stream.Stream<Uint8Array, E | SseEncodeError, R> =>
  eventsToSseText(events).pipe(Stream.encodeText)

export const toSseResponse = <E>(
  events: Stream.Stream<EventModel, E>,
): HttpServerResponse.HttpServerResponse =>
  HttpServerResponse.stream(eventsToSseBytes(events), {
    contentType: sseContentType,
    headers: sseHeaders,
  })

export const workspaceSseResponse = (
  workspaceId: string,
): Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  never,
  AppConfigTag | EventStore | Scope.Scope
> =>
  Effect.gen(function* () {
    const config = yield* AppConfigTag
    const store = yield* EventStore
    const events = yield* store.subscribe(workspaceId)
    const heartbeats = Stream.tick(config.sseHeartbeat).pipe(
      Stream.map(() => heartbeatFrame),
    )
    const eventFrames = eventsToSseText(events)
    const bytes = Stream.merge(eventFrames, heartbeats).pipe(Stream.encodeText)

    return HttpServerResponse.stream(bytes, {
      contentType: sseContentType,
      headers: sseHeaders,
    })
  })

export const collectSseText = <E, R>(
  stream: Stream.Stream<Uint8Array, E, R>,
): Effect.Effect<string, E, R> =>
  Effect.map(Stream.runCollect(stream), (chunks) =>
    Chunk.toReadonlyArray(chunks)
      .map((chunk) => new TextDecoder().decode(chunk))
      .join(''),
  )

export const heartbeatStream = (
  interval: Duration.DurationInput,
): Stream.Stream<string> =>
  Stream.tick(interval).pipe(Stream.map(() => heartbeatFrame))
