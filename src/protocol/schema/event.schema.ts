/** @Acp.Protocol.Event — append-only coordination primitive */
import { Schema } from 'effect'
import { EventId, WorkspaceId, WorkId, WorkerId } from './ids.js'
import { Timestamp } from './common.js'

export const EventType = Schema.Literal(
  'worker.online',
  'worker.offline',
  'worker.status_changed',
  'workspace.created',
  'workspace.updated',
  'workspace.archived',
  'work.created',
  'work.claimed',
  'work.started',
  'work.progressed',
  'work.blocked',
  'work.unblocked',
  'work.needs_review',
  'work.completed',
  'work.cancelled',
  'lease.requested',
  'lease.granted',
  'lease.denied',
  'lease.renewed',
  'lease.released',
  'lease.expired',
  'lease.revoked',
  'artifact.created',
  'artifact.updated',
  'artifact.deleted',
  'checkpoint.created',
  'memory.created',
  'review.requested',
  'review.approved',
  'review.rejected',
  'review.changes_requested',
  'review.cancelled',
  'review_comment.added',
  'review_comment.resolved',
  'review_comment.reopened',
)
export type EventType = typeof EventType.Type

export const Event = Schema.Struct({
  id: EventId,
  type: EventType,
  workspace_id: WorkspaceId,
  work_id: Schema.optionalWith(WorkId, { as: 'Option', nullable: true }),
  actor: WorkerId,
  timestamp: Timestamp,
  seq: Schema.Number,
  data: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})
export type Event = typeof Event.Type
