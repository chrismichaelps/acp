/** @Acp.Protocol.WorkUnit — wire + domain shape of a Work Unit */
import { Schema } from 'effect'
import { WorkId, WorkspaceId, WorkerId } from './ids.js'
import { WorkState, Priority, Timestamp } from './common.js'

export const WorkUnit = Schema.Struct({
  id: WorkId,
  workspace_id: WorkspaceId,
  title: Schema.NonEmptyString,
  description: Schema.optionalWith(Schema.String, {
    as: 'Option',
    nullable: true,
  }),
  state: WorkState,
  priority: Priority,
  created_by: WorkerId,
  assigned_to: Schema.optionalWith(WorkerId, { as: 'Option', nullable: true }),
  created_at: Timestamp,
  updated_at: Timestamp,
})
export type WorkUnit = typeof WorkUnit.Type

export const CreateWorkPayload = Schema.Struct({
  workspace_id: WorkspaceId,
  title: Schema.NonEmptyString,
  description: Schema.optionalWith(Schema.String, {
    as: 'Option',
    nullable: true,
  }),
  priority: Schema.optionalWith(Priority, {
    as: 'Option',
    nullable: true,
  }),
})
export type CreateWorkPayload = typeof CreateWorkPayload.Type

export const ClaimWorkPayload = Schema.Struct({
  worker_id: WorkerId,
})
export type ClaimWorkPayload = typeof ClaimWorkPayload.Type
