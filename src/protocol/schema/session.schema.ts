/** @Acp.Protocol.Session — wire + domain shape of a Session */
import { Schema } from 'effect'
import { Permission, Timestamp } from './common.js'
import { SessionId, WorkerId } from './ids.js'

export const Session = Schema.Struct({
  id: SessionId,
  worker_id: WorkerId,
  created_at: Timestamp,
  permissions: Schema.Array(Permission),
})
export type Session = typeof Session.Type
