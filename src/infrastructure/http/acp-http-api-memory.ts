/** @Acp.Infra.Http.Api.Memory — Memory record contract */
import { HttpApiEndpoint, HttpApiGroup } from '@effect/platform'
import { Schema } from 'effect'
import {
  CreateMemoryPayload,
  Memory,
  MemoryKind,
  ProtocolError,
  WorkId,
  WorkspaceId,
} from '../../protocol/schema/index.js'

const protocolError = (status: number) =>
  ({ status }) satisfies { readonly status: number }

export const MemoryListParams = Schema.Struct({
  workspace_id: WorkspaceId,
  after_seq: Schema.optionalWith(
    Schema.NumberFromString.pipe(Schema.int(), Schema.nonNegative()),
    { default: () => 0 },
  ),
  limit: Schema.optionalWith(
    Schema.NumberFromString.pipe(Schema.int(), Schema.positive()),
    { as: 'Option' },
  ),
  work_id: Schema.optionalWith(WorkId, { as: 'Option' }),
  kind: Schema.optionalWith(MemoryKind, { as: 'Option' }),
  key: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
  label: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
export type MemoryListParams = typeof MemoryListParams.Type

export const MemoryGroup = HttpApiGroup.make('memory')
  .add(
    HttpApiEndpoint.post('createMemory', '/v1/memory')
      .setPayload(CreateMemoryPayload)
      .addSuccess(Memory, { status: 201 })
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(401)),
  )
  .add(
    HttpApiEndpoint.get('listMemory', '/v1/memory')
      .setUrlParams(MemoryListParams)
      .addSuccess(Schema.Array(Memory))
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(401)),
  )
