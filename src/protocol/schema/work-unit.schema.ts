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
  /**
   * The work unit this one was spawned from — see
   * [[ADR-0021-work-unit-spawn-graph]]. Set once at creation and immutable, so
   * a parent always predates its child and the graph cannot contain a cycle.
   */
  parent_id: Schema.optionalWith(WorkId, { as: 'Option', nullable: true }),
  /**
   * Distance from the root, `0` for a root. Host-derived, never client-supplied.
   * Stored rather than walked so the depth cap is an O(1) check at creation and
   * descendant ordering needs no recomputation. Rows written before the spawn
   * graph existed decode as `0`, which is correct — they have no parent.
   */
  depth: Schema.optionalWith(Schema.Int, { default: () => 0, nullable: true }),
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
  /** Spawns this work unit under an existing one in the same workspace. */
  parent_id: Schema.optionalWith(WorkId, { as: 'Option', nullable: true }),
})
export type CreateWorkPayload = typeof CreateWorkPayload.Type

export const ClaimWorkPayload = Schema.Struct({
  worker_id: WorkerId,
})
export type ClaimWorkPayload = typeof ClaimWorkPayload.Type
