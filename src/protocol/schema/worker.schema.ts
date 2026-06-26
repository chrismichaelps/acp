/** @Acp.Protocol.Worker — wire + domain shape of a Worker */
import { Schema } from 'effect'
import { WorkerId } from './ids.js'
import { WorkerKind, WorkerStatus } from './common.js'

export const Capability = Schema.Literal(
  'can_edit_files',
  'can_run_commands',
  'can_create_prs',
  'can_review',
  'supports_checkpoints',
  'supports_leases',
)
export type Capability = typeof Capability.Type

export const Worker = Schema.Struct({
  id: WorkerId,
  name: Schema.NonEmptyString,
  kind: WorkerKind,
  vendor: Schema.optionalWith(Schema.String, { as: 'Option', nullable: true }),
  status: WorkerStatus,
  capabilities: Schema.Array(Capability),
})
export type Worker = typeof Worker.Type
