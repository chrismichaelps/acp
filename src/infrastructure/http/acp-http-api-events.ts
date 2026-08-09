/** @Acp.Infra.Http.Api.Events — event replay and stream contract */
import { HttpApiEndpoint, HttpApiGroup } from '@effect/platform'
import { Schema } from 'effect'
import {
  Event,
  EventType,
  ProtocolError,
  WorkspaceId,
} from '../../protocol/schema/index.js'

const protocolError = (status: number) =>
  ({ status }) satisfies { readonly status: number }

export const EventsStreamParams = Schema.Struct({
  workspace_id: WorkspaceId,
})
export type EventsStreamParams = typeof EventsStreamParams.Type

export const EventsReplayParams = Schema.Struct({
  workspace_id: WorkspaceId,
  after_seq: Schema.optionalWith(
    Schema.NumberFromString.pipe(Schema.int(), Schema.nonNegative()),
    { default: () => 0 },
  ),
  limit: Schema.optionalWith(
    Schema.NumberFromString.pipe(Schema.int(), Schema.positive()),
    { as: 'Option' },
  ),
  // Newest-first read bound. Mutually exclusive with `after_seq`: a request
  // supplying both has no single sensible meaning, so the route rejects it.
  tail: Schema.optionalWith(
    Schema.NumberFromString.pipe(Schema.int(), Schema.positive()),
    { as: 'Option' },
  ),
  // Optional server-side event-type filter, validated against the closed
  // `EventType` vocabulary.
  //
  // This was previously a plain string, so an unknown type replayed as `200 []`
  // to preserve the CLI's old client-side filtering. That made a typo
  // indistinguishable from "no such events happened" — the caller cannot tell a
  // wrong question from a true empty answer. Rejecting the filter still yields
  // the property that comment cared about (an unknown type never replays the
  // whole log), while every other closed vocabulary in the protocol already
  // refuses unknown values. See [[ADR-0029-resumption-event-accuracy]].
  type: Schema.optional(EventType),
})
export type EventsReplayParams = typeof EventsReplayParams.Type

export const EventsGroup = HttpApiGroup.make('events')
  .add(
    HttpApiEndpoint.get('replayEvents', '/v1/events')
      .setUrlParams(EventsReplayParams)
      .addSuccess(Schema.Array(Event))
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(401)),
  )
  .add(
    HttpApiEndpoint.get('streamEvents', '/v1/events/stream')
      .setUrlParams(EventsStreamParams)
      .addSuccess(Schema.Array(Event))
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(401)),
  )
