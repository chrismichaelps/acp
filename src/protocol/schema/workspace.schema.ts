/** @Acp.Protocol.Workspace — wire + domain shape of a Workspace */
import { Schema } from 'effect'
import { WorkspaceId } from './ids.js'
import { WorkspaceKind } from './common.js'

export const Workspace = Schema.Struct({
  id: WorkspaceId,
  name: Schema.NonEmptyString,
  kind: WorkspaceKind,
  uri: Schema.NonEmptyString,
  default_branch: Schema.optionalWith(Schema.String, {
    as: 'Option',
    nullable: true,
  }),
  metadata: Schema.Record({ key: Schema.String, value: Schema.String }),
})
export type Workspace = typeof Workspace.Type
