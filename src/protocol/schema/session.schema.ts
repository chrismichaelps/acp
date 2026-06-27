/** @Acp.Protocol.Session — wire + domain shape of a Session */
import { Schema } from 'effect'
import { Timestamp } from './common.js'
import { SessionId, WorkerId } from './ids.js'

export const Session = Schema.Struct({
  id: SessionId,
  worker_id: WorkerId,
  created_at: Timestamp,
})
export type Session = typeof Session.Type
