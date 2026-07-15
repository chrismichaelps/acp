/** @Acp.Protocol.Session — wire + domain shape of a Session */
import { Schema } from 'effect'
import { Permission, Timestamp } from './common.js'
import { SessionId, WorkerId, WorkspaceId } from './ids.js'

export const SessionPermissions = Schema.Array(Permission).pipe(
  Schema.filter((permissions) =>
    permissions.includes('review:respond') &&
    permissions.includes('review:collaborate')
      ? 'review:respond and review:collaborate are mutually exclusive'
      : undefined,
  ),
)
export type SessionPermissions = typeof SessionPermissions.Type

export const SessionIssuanceProvenance = Schema.Struct({
  mode: Schema.Literal('static'),
  issuer_id: Schema.NonEmptyString,
  principal_id: Schema.NonEmptyString,
  revision: Schema.NonEmptyString,
})
export type SessionIssuanceProvenance = typeof SessionIssuanceProvenance.Type

export const Session = Schema.Struct({
  id: SessionId,
  worker_id: WorkerId,
  created_at: Timestamp,
  permissions: SessionPermissions,
  workspace_ids: Schema.optionalWith(Schema.Array(WorkspaceId), {
    as: 'Option',
    nullable: true,
  }),
  issuance: Schema.optionalWith(SessionIssuanceProvenance, {
    as: 'Option',
    nullable: true,
  }),
})
export type Session = typeof Session.Type
