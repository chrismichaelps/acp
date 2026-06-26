/** @Acp.Protocol.Lease — wire + domain shape of a Lease */
import { Schema } from 'effect'
import { LeaseId, WorkspaceId, WorkId, WorkerId } from './ids.js'
import { LeaseState, Timestamp, Resource } from './common.js'

export const Lease = Schema.Struct({
  id: LeaseId,
  workspace_id: WorkspaceId,
  work_id: Schema.optionalWith(WorkId, { as: 'Option', nullable: true }),
  holder: WorkerId,
  resource: Resource,
  expires_at: Timestamp,
  state: LeaseState,
})
export type Lease = typeof Lease.Type

export const RequestLeasePayload = Schema.Struct({
  workspace_id: WorkspaceId,
  work_id: Schema.optionalWith(WorkId, { as: 'Option', nullable: true }),
  holder: WorkerId,
  resource: Resource,
  ttl_seconds: Schema.optionalWith(Schema.Positive, {
    as: 'Option',
    nullable: true,
  }),
})
export type RequestLeasePayload = typeof RequestLeasePayload.Type
