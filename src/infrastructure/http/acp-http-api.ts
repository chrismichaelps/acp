/** @Acp.Infra.Http.Api — Effect Platform REST contract */
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from '@effect/platform'
import { Schema } from 'effect'
import {
  Artifact,
  ArtifactId,
  Capability,
  Checkpoint,
  ClaimWorkPayload,
  CreateArtifactPayload,
  CreateCheckpointPayload,
  CreateWorkPayload,
  CreateWorkspacePayload,
  Event,
  EventType,
  Lease,
  LeaseId,
  Permission,
  ProtocolError,
  RequestLeasePayload,
  RequestReviewPayload,
  Review,
  ReviewId,
  SessionId,
  UpdateArtifactPayload,
  UpdateWorkspacePayload,
  WorkId,
  Worker,
  Workspace,
  WorkspaceId,
  WorkState,
  WorkerKind,
  WorkerStatus,
  WorkUnit,
  ACP_PROTOCOL_VERSION,
} from '../../protocol/schema/index.js'

export const WorkPath = Schema.Struct({
  work_id: HttpApiSchema.param('work_id', WorkId),
})
export type WorkPath = typeof WorkPath.Type

export const LeasePath = Schema.Struct({
  lease_id: HttpApiSchema.param('lease_id', LeaseId),
})
export type LeasePath = typeof LeasePath.Type

export const ReviewPath = Schema.Struct({
  review_id: HttpApiSchema.param('review_id', ReviewId),
})
export type ReviewPath = typeof ReviewPath.Type

export const ArtifactPath = Schema.Struct({
  artifact_id: HttpApiSchema.param('artifact_id', ArtifactId),
})
export type ArtifactPath = typeof ArtifactPath.Type

export const EventsStreamParams = Schema.Struct({
  workspace_id: WorkspaceId,
})
export type EventsStreamParams = typeof EventsStreamParams.Type

export const WorkspacePath = Schema.Struct({
  workspace_id: HttpApiSchema.param('workspace_id', WorkspaceId),
})
export type WorkspacePath = typeof WorkspacePath.Type

export const ClientCapabilities = Schema.Struct({
  can_edit_files: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  can_run_commands: Schema.optionalWith(Schema.Boolean, {
    default: () => false,
  }),
  can_create_prs: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  can_review: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  supports_checkpoints: Schema.optionalWith(Schema.Boolean, {
    default: () => false,
  }),
  supports_leases: Schema.optionalWith(Schema.Boolean, {
    default: () => false,
  }),
})
export type ClientCapabilities = typeof ClientCapabilities.Type

export const InitializeSessionWorker = Schema.Struct({
  id: Worker.fields.id,
  name: Worker.fields.name,
  kind: WorkerKind,
  vendor: Worker.fields.vendor,
  status: Schema.optionalWith(WorkerStatus, { default: () => 'online' }),
  capabilities: Schema.optionalWith(Schema.Array(Capability), {
    default: () => [],
  }),
})
export type InitializeSessionWorker = typeof InitializeSessionWorker.Type

export const InitializeSessionPayload = Schema.Struct({
  protocol_version: Schema.optionalWith(Schema.String, {
    default: () => ACP_PROTOCOL_VERSION,
  }),
  worker: InitializeSessionWorker,
  capabilities: Schema.optionalWith(ClientCapabilities, {
    default: () => ({
      can_edit_files: false,
      can_run_commands: false,
      can_create_prs: false,
      can_review: false,
      supports_checkpoints: false,
      supports_leases: false,
    }),
  }),
  permissions: Schema.optionalWith(Schema.Array(Permission), {
    default: () => [],
  }),
})
export type InitializeSessionPayload = typeof InitializeSessionPayload.Type

export const HostDescriptor = Schema.Struct({
  name: Schema.NonEmptyString,
  kind: Schema.Literal('local'),
})
export type HostDescriptor = typeof HostDescriptor.Type

export const HostCapabilities = Schema.Struct({
  supports_events: Schema.Boolean,
  supports_reviews: Schema.Boolean,
  supports_artifacts: Schema.Boolean,
  supports_sse: Schema.Boolean,
})
export type HostCapabilities = typeof HostCapabilities.Type

export const InitializeSessionResponse = Schema.Struct({
  session_id: SessionId,
  protocol_version: Schema.Literal(ACP_PROTOCOL_VERSION),
  host: HostDescriptor,
  capabilities: HostCapabilities,
})
export type InitializeSessionResponse = typeof InitializeSessionResponse.Type

export const UpdateWorkStatePayload = Schema.Struct({
  state: WorkState,
})
export type UpdateWorkStatePayload = typeof UpdateWorkStatePayload.Type

export const PublishWorkEventPayload = Schema.Struct({
  type: EventType,
  data: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})
export type PublishWorkEventPayload = typeof PublishWorkEventPayload.Type

export const ApproveReviewPayload = Schema.Struct({
  met_requirements: Schema.Array(Schema.String),
})
export type ApproveReviewPayload = typeof ApproveReviewPayload.Type

export const ArtifactContentResponse = Schema.Struct({
  content: Schema.String,
})
export type ArtifactContentResponse = typeof ArtifactContentResponse.Type

const protocolError = (status: number) =>
  ({ status }) satisfies { readonly status: number }

export const SessionGroup = HttpApiGroup.make('session').add(
  HttpApiEndpoint.post('initializeSession', '/v1/session/initialize')
    .setPayload(InitializeSessionPayload)
    .addSuccess(InitializeSessionResponse)
    .addError(ProtocolError, protocolError(400))
    .addError(ProtocolError, protocolError(401)),
)

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

export const WorkGroup = HttpApiGroup.make('work')
  .add(
    HttpApiEndpoint.post('createWork', '/v1/work')
      .setPayload(CreateWorkPayload)
      .addSuccess(WorkUnit, { status: 201 })
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(401)),
  )
  .add(
    HttpApiEndpoint.get('getWork', '/v1/work/:work_id')
      .setPath(WorkPath)
      .addSuccess(WorkUnit)
      .addError(ProtocolError, protocolError(401))
      .addError(ProtocolError, protocolError(404)),
  )
  .add(
    HttpApiEndpoint.post('claimWork', '/v1/work/:work_id/claim')
      .setPath(WorkPath)
      .setPayload(ClaimWorkPayload)
      .addSuccess(WorkUnit)
      .addError(ProtocolError, protocolError(404))
      .addError(ProtocolError, protocolError(409)),
  )
  .add(
    HttpApiEndpoint.patch('updateWorkState', '/v1/work/:work_id')
      .setPath(WorkPath)
      .setPayload(UpdateWorkStatePayload)
      .addSuccess(WorkUnit)
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(404))
      .addError(ProtocolError, protocolError(409)),
  )
  .add(
    HttpApiEndpoint.post('publishWorkEvent', '/v1/work/:work_id/events')
      .setPath(WorkPath)
      .setPayload(PublishWorkEventPayload)
      .addSuccess(Event, { status: 201 })
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(404)),
  )
  .add(
    HttpApiEndpoint.get('listWorkCheckpoints', '/v1/work/:work_id/checkpoints')
      .setPath(WorkPath)
      .addSuccess(Schema.Array(Checkpoint))
      .addError(ProtocolError, protocolError(401))
      .addError(ProtocolError, protocolError(404)),
  )
  .add(
    HttpApiEndpoint.get(
      'latestWorkCheckpoint',
      '/v1/work/:work_id/checkpoints/latest',
    )
      .setPath(WorkPath)
      .addSuccess(Checkpoint)
      .addError(ProtocolError, protocolError(401))
      .addError(ProtocolError, protocolError(404)),
  )
  .add(
    HttpApiEndpoint.get('listWorkArtifacts', '/v1/work/:work_id/artifacts')
      .setPath(WorkPath)
      .addSuccess(Schema.Array(Artifact))
      .addError(ProtocolError, protocolError(401))
      .addError(ProtocolError, protocolError(404)),
  )
  .add(
    HttpApiEndpoint.get('listWorkReviews', '/v1/work/:work_id/reviews')
      .setPath(WorkPath)
      .addSuccess(Schema.Array(Review))
      .addError(ProtocolError, protocolError(401))
      .addError(ProtocolError, protocolError(404)),
  )

export const LeaseGroup = HttpApiGroup.make('leases')
  .add(
    HttpApiEndpoint.post('requestLease', '/v1/leases')
      .setPayload(RequestLeasePayload)
      .addSuccess(Lease, { status: 201 })
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(409)),
  )
  .add(
    HttpApiEndpoint.post('releaseLease', '/v1/leases/:lease_id/release')
      .setPath(LeasePath)
      .addSuccess(HttpApiSchema.NoContent)
      .addError(ProtocolError, protocolError(404)),
  )

export const ArtifactGroup = HttpApiGroup.make('artifacts')
  .add(
    HttpApiEndpoint.post('createArtifact', '/v1/artifacts')
      .setPayload(CreateArtifactPayload)
      .addSuccess(Artifact, { status: 201 })
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(404)),
  )
  .add(
    HttpApiEndpoint.patch('updateArtifact', '/v1/artifacts/:artifact_id')
      .setPath(ArtifactPath)
      .setPayload(UpdateArtifactPayload)
      .addSuccess(Artifact)
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(401))
      .addError(ProtocolError, protocolError(404)),
  )
  .add(
    HttpApiEndpoint.del('deleteArtifact', '/v1/artifacts/:artifact_id')
      .setPath(ArtifactPath)
      .addSuccess(Artifact)
      .addError(ProtocolError, protocolError(404)),
  )
  .add(
    HttpApiEndpoint.get(
      'getArtifactContent',
      '/v1/artifacts/:artifact_id/content',
    )
      .setPath(ArtifactPath)
      .addSuccess(ArtifactContentResponse)
      .addError(ProtocolError, protocolError(401))
      .addError(ProtocolError, protocolError(404)),
  )

export const CheckpointGroup = HttpApiGroup.make('checkpoints').add(
  HttpApiEndpoint.post('createCheckpoint', '/v1/checkpoints')
    .setPayload(CreateCheckpointPayload)
    .addSuccess(Checkpoint, { status: 201 })
    .addError(ProtocolError, protocolError(400))
    .addError(ProtocolError, protocolError(404)),
)

export const ReviewGroup = HttpApiGroup.make('reviews')
  .add(
    HttpApiEndpoint.post('requestReview', '/v1/reviews')
      .setPayload(RequestReviewPayload)
      .addSuccess(Review, { status: 201 })
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(404)),
  )
  .add(
    HttpApiEndpoint.post('approveReview', '/v1/reviews/:review_id/approve')
      .setPath(ReviewPath)
      .setPayload(ApproveReviewPayload)
      .addSuccess(Review)
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(404))
      .addError(ProtocolError, protocolError(409)),
  )
  .add(
    HttpApiEndpoint.post('rejectReview', '/v1/reviews/:review_id/reject')
      .setPath(ReviewPath)
      .addSuccess(Review)
      .addError(ProtocolError, protocolError(404))
      .addError(ProtocolError, protocolError(409)),
  )
  .add(
    HttpApiEndpoint.post(
      'requestReviewChanges',
      '/v1/reviews/:review_id/request_changes',
    )
      .setPath(ReviewPath)
      .addSuccess(Review)
      .addError(ProtocolError, protocolError(404))
      .addError(ProtocolError, protocolError(409)),
  )

export const EventsGroup = HttpApiGroup.make('events').add(
  HttpApiEndpoint.get('streamEvents', '/v1/events/stream')
    .setUrlParams(EventsStreamParams)
    .addSuccess(Schema.Array(Event))
    .addError(ProtocolError, protocolError(400))
    .addError(ProtocolError, protocolError(401)),
)

export class AcpHttpApi extends HttpApi.make('acp')
  .add(SessionGroup)
  .add(WorkspaceGroup)
  .add(WorkGroup)
  .add(LeaseGroup)
  .add(ArtifactGroup)
  .add(CheckpointGroup)
  .add(ReviewGroup)
  .add(EventsGroup) {}
