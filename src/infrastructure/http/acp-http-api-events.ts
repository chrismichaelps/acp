/** @Acp.Infra.Http.Api.Events — event replay and stream contract */
import { HttpApiEndpoint, HttpApiGroup } from '@effect/platform'
import { Schema } from 'effect'
import {
  Event,
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
  // Optional server-side event-type filter. Kept lenient (a plain string) so an
  // unknown type yields an empty replay rather than a 400 — matching the CLI's
  // prior client-side `--type` behavior, now honored across every transport.
  type: Schema.optional(Schema.String),
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
