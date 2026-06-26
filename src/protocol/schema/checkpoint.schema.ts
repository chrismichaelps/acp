/** @Acp.Protocol.Checkpoint — wire + domain shape of a Checkpoint */
import { Schema } from 'effect'
import { CheckpointId, WorkId, WorkspaceId, WorkerId } from './ids.js'
import { Timestamp } from './common.js'

export const Checkpoint = Schema.Struct({
  id: CheckpointId,
  work_id: WorkId,
  workspace_id: WorkspaceId,
  created_by: WorkerId,
  summary: Schema.NonEmptyString,
  completed_steps: Schema.Array(Schema.String),
  remaining_steps: Schema.Array(Schema.String),
  modified_resources: Schema.Array(Schema.String),
  created_at: Timestamp,
})
export type Checkpoint = typeof Checkpoint.Type

export const CreateCheckpointPayload = Schema.Struct({
  workspace_id: WorkspaceId,
  work_id: WorkId,
  summary: Schema.NonEmptyString,
  completed_steps: Schema.Array(Schema.String),
  remaining_steps: Schema.Array(Schema.String),
  modified_resources: Schema.Array(Schema.String),
})
export type CreateCheckpointPayload = typeof CreateCheckpointPayload.Type
