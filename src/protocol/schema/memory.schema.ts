/** @Acp.Protocol.Memory — wire + domain shape of Memory */
import { Schema } from 'effect'
import { MemoryId, WorkId, WorkerId, WorkspaceId } from './ids.js'
import { MemoryKind, Timestamp } from './common.js'

export const Memory = Schema.Struct({
  id: MemoryId,
  workspace_id: WorkspaceId,
  work_id: Schema.optionalWith(WorkId, { as: 'Option', nullable: true }),
  seq: Schema.Number,
  created_by: WorkerId,
  kind: MemoryKind,
  key: Schema.NonEmptyString,
  summary: Schema.NonEmptyString,
  content: Schema.NonEmptyString,
  labels: Schema.Array(Schema.String),
  created_at: Timestamp,
})
export type Memory = typeof Memory.Type

export const CreateMemoryPayload = Schema.Struct({
  workspace_id: WorkspaceId,
  work_id: Memory.fields.work_id,
  kind: MemoryKind,
  key: Schema.NonEmptyString,
  summary: Schema.NonEmptyString,
  content: Schema.NonEmptyString,
  labels: Schema.Array(Schema.String),
})
export type CreateMemoryPayload = typeof CreateMemoryPayload.Type

export const ReadMemoryQuery = Schema.Struct({
  workspace_id: WorkspaceId,
  after_seq: Schema.Number,
  limit: Schema.optionalWith(Schema.Number, { as: 'Option', nullable: true }),
  work_id: Memory.fields.work_id,
  kind: Schema.optionalWith(MemoryKind, { as: 'Option', nullable: true }),
  key: Schema.optionalWith(Schema.NonEmptyString, {
    as: 'Option',
    nullable: true,
  }),
  label: Schema.optionalWith(Schema.String, { as: 'Option', nullable: true }),
})
export type ReadMemoryQuery = typeof ReadMemoryQuery.Type
