/** @Acp.Protocol.Session — wire + domain shape of a Session */
import { Schema } from 'effect'
import { Permission, Timestamp } from './common.js'
import { SessionId, WorkerId, WorkspaceId } from './ids.js'

export const Session = Schema.Struct({
  id: SessionId,
  worker_id: WorkerId,
  created_at: Timestamp,
  permissions: Schema.Array(Permission),
  workspace_ids: Schema.optionalWith(Schema.Array(WorkspaceId), {
    as: 'Option',
    nullable: true,
  }),
})
export type Session = typeof Session.Type
