/** @Acp.App.Server.EventRoutes — workspace event replay and stream handlers */
import { HttpServerRequest } from '@effect/platform'
import { Chunk, Effect, Option, Schema } from 'effect'
import { EventStore } from '../../domain/events/index.js'
import {
  EventsReplayParams,
  EventsStreamParams,
} from '../../infrastructure/http/index.js'
import { workspaceSseResponse } from '../../infrastructure/sse/index.js'
import { ValidationError } from '../../protocol/errors/protocol-error.js'
import { Event } from '../../protocol/schema/index.js'
import { authorizeWorkspace, ok, respond } from './route-support.js'

export const replayEvents = respond('GET /v1/events')(
  Effect.gen(function* () {
    const events = yield* EventStore
    const request = yield* HttpServerRequest.HttpServerRequest
    const params =
      yield* HttpServerRequest.schemaSearchParams(EventsReplayParams)
    yield* authorizeWorkspace('event:read', params.workspace_id)

    // `after_seq` defaults to 0, so presence has to be read from the raw query
    // rather than inferred from the decoded value.
    const raw = new URL(request.url, 'http://acp.local').searchParams
    if (raw.has('tail') && raw.has('after_seq')) {
      return yield* Effect.fail(
        new ValidationError({
          issues: ['tail and after_seq are mutually exclusive'],
        }),
      )
    }

    const replay = Option.isSome(params.tail)
      ? yield* events.readTail(params.workspace_id, params.tail.value)
      : yield* events.readAfter(
          params.workspace_id,
          params.after_seq,
          params.limit,
        )
    const all = Chunk.toReadonlyArray(replay)
    // Optional type filter, applied within the read window (same semantics the
    // CLI used client-side), so every transport can filter by type server-side.
    const filtered =
      params.type === undefined
        ? all
        : all.filter((event) => event.type === params.type)
    return yield* ok(200)(Schema.Array(Event), filtered)
  }),
)

export const streamEvents = respond('GET /v1/events/stream')(
  Effect.gen(function* () {
    const params =
      yield* HttpServerRequest.schemaSearchParams(EventsStreamParams)
    yield* authorizeWorkspace('event:read', params.workspace_id)
    return yield* workspaceSseResponse(params.workspace_id)
  }),
)
