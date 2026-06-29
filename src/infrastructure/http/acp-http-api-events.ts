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
