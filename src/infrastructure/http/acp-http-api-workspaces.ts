/** @Acp.Infra.Http.Api.Workspaces — workspace-scoped endpoint declarations */
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform'
import { Schema } from 'effect'
import {
  Artifact,
  Checkpoint,
  CreateWorkspacePayload,
  ProtocolError,
  Review,
  UpdateWorkspacePayload,
  WorkUnit,
  Workspace,
  WorkspaceId,
} from '../../protocol/schema/index.js'

export const WorkspacePath = Schema.Struct({
  workspace_id: HttpApiSchema.param('workspace_id', WorkspaceId),
})
export type WorkspacePath = typeof WorkspacePath.Type

// Local, matching the sibling convention: each group file is self-contained so
// there is no import cycle back into the root contract module.
const protocolError = (status: number) =>
  ({ status }) satisfies { readonly status: number }

export const WorkspaceGroup = HttpApiGroup.make('workspaces')
  .add(
    HttpApiEndpoint.get('listWorkspaces', '/v1/workspaces')
      .addSuccess(Schema.Array(Workspace))
      .addError(ProtocolError, protocolError(401)),
  )
  .add(
    HttpApiEndpoint.post('createWorkspace', '/v1/workspaces')
      .setPayload(CreateWorkspacePayload)
      .addSuccess(Workspace, { status: 201 })
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(401)),
  )
  .add(
    HttpApiEndpoint.patch('updateWorkspace', '/v1/workspaces/:workspace_id')
      .setPath(WorkspacePath)
      .setPayload(UpdateWorkspacePayload)
      .addSuccess(Workspace)
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(401))
      .addError(ProtocolError, protocolError(404)),
  )
  .add(
    HttpApiEndpoint.post(
      'archiveWorkspace',
      '/v1/workspaces/:workspace_id/archive',
    )
      .setPath(WorkspacePath)
      .addSuccess(Workspace)
      .addError(ProtocolError, protocolError(401))
      .addError(ProtocolError, protocolError(404))
      .addError(ProtocolError, protocolError(409)),
  )
  .add(
    HttpApiEndpoint.get(
      'listWorkspaceWork',
      '/v1/workspaces/:workspace_id/work',
    )
      .setPath(WorkspacePath)
      .addSuccess(Schema.Array(WorkUnit))
      .addError(ProtocolError, protocolError(401))
      .addError(ProtocolError, protocolError(404)),
  )
  .add(
    HttpApiEndpoint.get(
      'listWorkspaceCheckpoints',
      '/v1/workspaces/:workspace_id/checkpoints',
    )
      .setPath(WorkspacePath)
      .addSuccess(Schema.Array(Checkpoint))
      .addError(ProtocolError, protocolError(401))
      .addError(ProtocolError, protocolError(404)),
  )
  .add(
    HttpApiEndpoint.get(
      'listWorkspaceArtifacts',
      '/v1/workspaces/:workspace_id/artifacts',
    )
      .setPath(WorkspacePath)
      .addSuccess(Schema.Array(Artifact))
      .addError(ProtocolError, protocolError(401))
      .addError(ProtocolError, protocolError(404)),
  )
  .add(
    HttpApiEndpoint.get(
      'listWorkspaceReviews',
      '/v1/workspaces/:workspace_id/reviews',
    )
      .setPath(WorkspacePath)
      .addSuccess(Schema.Array(Review))
      .addError(ProtocolError, protocolError(401))
      .addError(ProtocolError, protocolError(404)),
  )
