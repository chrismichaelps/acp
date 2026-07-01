/** @Acp.App.Server.EventRoutes — workspace event replay and stream handlers */
import { HttpServerRequest } from '@effect/platform'
import { Chunk, Effect, Schema } from 'effect'
import { EventStore } from '../../domain/events/index.js'
import {
  EventsReplayParams,
  EventsStreamParams,
} from '../../infrastructure/http/index.js'
import { workspaceSseResponse } from '../../infrastructure/sse/index.js'
import { Event } from '../../protocol/schema/index.js'
import { authorize, ok, respond } from './route-support.js'

export const replayEvents = respond('GET /v1/events')(
  Effect.gen(function* () {
    const events = yield* EventStore
    const params =
      yield* HttpServerRequest.schemaSearchParams(EventsReplayParams)
    yield* authorize('event:read')
    const replay = yield* events.readAfter(
      params.workspace_id,
      params.after_seq,
    )
    return yield* ok(200)(Schema.Array(Event), Chunk.toReadonlyArray(replay))
  }),
)

export const streamEvents = respond('GET /v1/events/stream')(
  Effect.gen(function* () {
    const params =
      yield* HttpServerRequest.schemaSearchParams(EventsStreamParams)
    yield* authorize('event:read')
    return yield* workspaceSseResponse(params.workspace_id)
  }),
)
