/** @Acp.Protocol.Sandbox — wire shape of a work unit's sandbox */
import { Schema } from 'effect'
import { WorkId } from './ids.js'

export const SandboxStatus = Schema.Literal(
  'starting',
  'running',
  'exited',
  'absent',
)
export type SandboxStatus = typeof SandboxStatus.Type

export const Sandbox = Schema.Struct({
  work_id: WorkId,
  status: SandboxStatus,
  /** Adapter-specific identifier, e.g. a container id. Absent when unprovisioned. */
  external_id: Schema.optionalWith(Schema.String, {
    as: 'Option',
    nullable: true,
  }),
  /** Present only once the sandbox has exited. */
  exit_code: Schema.optionalWith(Schema.Int, { as: 'Option', nullable: true }),
})
export type Sandbox = typeof Sandbox.Type
