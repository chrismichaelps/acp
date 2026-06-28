/** @Acp.Protocol.Workspace — wire + domain shape of a Workspace */
import { Schema } from 'effect'
import { WorkspaceId } from './ids.js'
import { WorkspaceKind, WorkspaceState } from './common.js'

export const Workspace = Schema.Struct({
  id: WorkspaceId,
  name: Schema.NonEmptyString,
  kind: WorkspaceKind,
  uri: Schema.NonEmptyString,
  state: Schema.optionalWith(WorkspaceState, { default: () => 'active' }),
  default_branch: Schema.optionalWith(Schema.String, {
    as: 'Option',
    nullable: true,
  }),
  metadata: Schema.Record({ key: Schema.String, value: Schema.String }),
})
export type Workspace = typeof Workspace.Type

export const CreateWorkspacePayload = Schema.Struct({
  name: Workspace.fields.name,
  kind: WorkspaceKind,
  uri: Workspace.fields.uri,
  default_branch: Workspace.fields.default_branch,
  metadata: Schema.optionalWith(Workspace.fields.metadata, {
    default: () => ({}),
  }),
})
export type CreateWorkspacePayload = typeof CreateWorkspacePayload.Type

export const UpdateWorkspacePayload = CreateWorkspacePayload
export type UpdateWorkspacePayload = typeof UpdateWorkspacePayload.Type
