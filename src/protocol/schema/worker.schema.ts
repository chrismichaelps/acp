/** @Acp.Protocol.Worker — wire + domain shape of a Worker */
import { Schema } from 'effect'
import { WorkerId } from './ids.js'
import { Timestamp, WorkerKind, WorkerStatus } from './common.js'

export const Capability = Schema.Literal(
  'can_edit_files',
  'can_run_commands',
  'can_create_prs',
  'can_review',
  'supports_checkpoints',
  'supports_leases',
)
export type Capability = typeof Capability.Type

/**
 * What software is actually running, as opposed to what it claims it can do.
 * Capabilities describe intent; the bill of materials answers the post-incident
 * question — see [[ADR-0024-worker-identity-provenance]].
 */
export const WorkerBom = Schema.Struct({
  worker_version: Schema.NonEmptyString,
  harness: Schema.NonEmptyString,
  location: Schema.NonEmptyString,
})
export type WorkerBom = typeof WorkerBom.Type

export const Worker = Schema.Struct({
  id: WorkerId,
  name: Schema.NonEmptyString,
  kind: WorkerKind,
  vendor: Schema.optionalWith(Schema.String, { as: 'Option', nullable: true }),
  status: WorkerStatus,
  capabilities: Schema.Array(Capability),
  /**
   * Base64 SPKI Ed25519 public key. The host never accepts private key
   * material, and rotation is re-registration: a mutable key would leave past
   * signatures verifying against a key the worker no longer holds.
   */
  public_key: Schema.optionalWith(Schema.NonEmptyString, {
    as: 'Option',
    nullable: true,
  }),
  bom: Schema.optionalWith(WorkerBom, { as: 'Option', nullable: true }),
  /** Registration lapses without heartbeat; the row survives for the audit trail. */
  expires_at: Schema.optionalWith(Timestamp, { as: 'Option', nullable: true }),
})
export type Worker = typeof Worker.Type
