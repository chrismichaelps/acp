/** @Acp.Infra.Rpc.Contract — native Effect RPC contract */
import { Rpc, RpcGroup } from '@effect/rpc'
import { Schema } from 'effect'
import {
  Artifact,
  ArtifactId,
  Checkpoint,
  ClaimWorkPayload,
  CreateArtifactPayload,
  CreateCheckpointPayload,
  CreateMemoryPayload,
  CreateWorkPayload,
  CreateWorkspacePayload,
  Event,
  Lease,
  LeaseId,
  Memory,
  ProtocolError,
  ReadMemoryQuery,
  RequestLeasePayload,
  RequestReviewPayload,
  Review,
  ReviewId,
  UpdateArtifactPayload,
  UpdateWorkspacePayload,
  WorkId,
  Worker,
  WorkerId,
  WorkUnit,
  Workspace,
  WorkspaceId,
} from '../../protocol/schema/index.js'
import type { Permission } from '../../protocol/schema/index.js'
import {
  ApproveReviewPayload,
  ArtifactContentResponse,
  InitializeSessionPayload,
  InitializeSessionResponse,
  PublishWorkEventPayload,
  RenewLeasePayload,
  UpdateWorkStatePayload,
} from '../http/acp-http-api.js'
import {
  AcpRpcAuthMiddleware,
  AcpRpcRequiredScope,
} from './rpc-auth-middleware.js'
import { AcpRpcTelemetryMiddleware } from './rpc-telemetry-middleware.js'

const WorkerIdPayload = Schema.Struct({ worker_id: WorkerId })
const WorkspaceIdPayload = Schema.Struct({ workspace_id: WorkspaceId })
const WorkIdPayload = Schema.Struct({ work_id: WorkId })
const LeaseIdPayload = Schema.Struct({ lease_id: LeaseId })
const ArtifactIdPayload = Schema.Struct({ artifact_id: ArtifactId })
const ReviewIdPayload = Schema.Struct({ review_id: ReviewId })

const WorkspaceWorkListPayload = WorkspaceIdPayload
const WorkspaceResumeListPayload = WorkspaceIdPayload
const WorkResumeListPayload = WorkIdPayload

const UpdateWorkspaceRpcPayload = Schema.Struct({
  workspace_id: WorkspaceId,
  ...UpdateWorkspacePayload.fields,
})

const ClaimWorkRpcPayload = Schema.Struct({
  work_id: WorkId,
  ...ClaimWorkPayload.fields,
})

const UpdateWorkStateRpcPayload = Schema.Struct({
  work_id: WorkId,
  ...UpdateWorkStatePayload.fields,
})

const PublishWorkEventRpcPayload = Schema.Struct({
  work_id: WorkId,
  ...PublishWorkEventPayload.fields,
})

const LeaseRenewRpcPayload = Schema.Struct({
  lease_id: LeaseId,
  ...RenewLeasePayload.fields,
})

const UpdateArtifactRpcPayload = Schema.Struct({
  artifact_id: ArtifactId,
  ...UpdateArtifactPayload.fields,
})

const ApproveReviewRpcPayload = Schema.Struct({
  review_id: ReviewId,
  ...ApproveReviewPayload.fields,
})

const rpc = <const Tag extends string>(tag: Tag) =>
  Rpc.make(tag).setError(ProtocolError)

interface ScopableRpc {
  annotate: (
    tag: typeof AcpRpcRequiredScope,
    value: Permission,
  ) => {
    middleware: (middleware: typeof AcpRpcAuthMiddleware) => {
      middleware: (middleware: typeof AcpRpcTelemetryMiddleware) => unknown
    }
  }
}

const scoped = <A extends ScopableRpc>(procedure: A, scope: Permission): A => {
  const annotated: unknown = procedure
    .annotate(AcpRpcRequiredScope, scope)
    .middleware(AcpRpcAuthMiddleware)
    .middleware(AcpRpcTelemetryMiddleware)
  return annotated as A
}

interface TelemetryRpc {
  middleware: (middleware: typeof AcpRpcTelemetryMiddleware) => unknown
}

const instrumented = <A extends TelemetryRpc>(procedure: A): A =>
  procedure.middleware(AcpRpcTelemetryMiddleware) as A

const workerList = scoped(
  rpc('worker.list').setSuccess(Schema.Array(Worker)),
  'worker:read',
)
const workerGet = rpc('worker.get')
  .setPayload(WorkerIdPayload)
  .setSuccess(Worker)
  .pipe((procedure) => scoped(procedure, 'worker:read'))

const sessionInitialize = instrumented(
  rpc('session.initialize')
    .setPayload(InitializeSessionPayload)
    .setSuccess(InitializeSessionResponse),
)

const workspaceList = scoped(
  rpc('workspace.list').setSuccess(Schema.Array(Workspace)),
  'workspace:read',
)
const workspaceCreate = scoped(
  rpc('workspace.create')
    .setPayload(CreateWorkspacePayload)
    .setSuccess(Workspace),
  'workspace:write',
)
const workspaceUpdate = scoped(
  rpc('workspace.update')
    .setPayload(UpdateWorkspaceRpcPayload)
    .setSuccess(Workspace),
  'workspace:write',
)
const workspaceArchive = scoped(
  rpc('workspace.archive').setPayload(WorkspaceIdPayload).setSuccess(Workspace),
  'workspace:write',
)

const workCreate = scoped(
  rpc('work.create').setPayload(CreateWorkPayload).setSuccess(WorkUnit),
  'work:create',
)
const workListForWorkspace = scoped(
  rpc('work.list_for_workspace')
    .setPayload(WorkspaceWorkListPayload)
    .setSuccess(Schema.Array(WorkUnit)),
  'workspace:read',
)
const workGet = scoped(
  rpc('work.get').setPayload(WorkIdPayload).setSuccess(WorkUnit),
  'workspace:read',
)
const workClaim = scoped(
  rpc('work.claim').setPayload(ClaimWorkRpcPayload).setSuccess(WorkUnit),
  'work:claim',
)
const workUpdateState = scoped(
  rpc('work.update_state')
    .setPayload(UpdateWorkStateRpcPayload)
    .setSuccess(WorkUnit),
  'work:update',
)
const workPublishEvent = scoped(
  rpc('work.publish_event')
    .setPayload(PublishWorkEventRpcPayload)
    .setSuccess(Event),
  'work:publish_event',
)

const leaseRequest = scoped(
  rpc('lease.request').setPayload(RequestLeasePayload).setSuccess(Lease),
  'lease:create',
)
const leaseList = scoped(
  rpc('lease.list')
    .setPayload(WorkspaceIdPayload)
    .setSuccess(Schema.Array(Lease)),
  'workspace:read',
)
const leaseRenew = scoped(
  rpc('lease.renew').setPayload(LeaseRenewRpcPayload).setSuccess(Lease),
  'lease:renew',
)
const leaseRelease = scoped(
  rpc('lease.release').setPayload(LeaseIdPayload).setSuccess(Schema.Void),
  'lease:release',
)
const leaseRevoke = scoped(
  rpc('lease.revoke').setPayload(LeaseIdPayload).setSuccess(Lease),
  'lease:revoke',
)

const artifactCreate = scoped(
  rpc('artifact.create').setPayload(CreateArtifactPayload).setSuccess(Artifact),
  'artifact:create',
)
const artifactUpdate = scoped(
  rpc('artifact.update')
    .setPayload(UpdateArtifactRpcPayload)
    .setSuccess(Artifact),
  'artifact:update',
)
const artifactDelete = scoped(
  rpc('artifact.delete').setPayload(ArtifactIdPayload).setSuccess(Artifact),
  'artifact:delete',
)
const artifactContent = scoped(
  rpc('artifact.content')
    .setPayload(ArtifactIdPayload)
    .setSuccess(ArtifactContentResponse),
  'workspace:read',
)
const artifactListForWork = scoped(
  rpc('artifact.list_for_work')
    .setPayload(WorkResumeListPayload)
    .setSuccess(Schema.Array(Artifact)),
  'workspace:read',
)
const artifactListForWorkspace = scoped(
  rpc('artifact.list_for_workspace')
    .setPayload(WorkspaceResumeListPayload)
    .setSuccess(Schema.Array(Artifact)),
  'workspace:read',
)

const checkpointCreate = scoped(
  rpc('checkpoint.create')
    .setPayload(CreateCheckpointPayload)
    .setSuccess(Checkpoint),
  'checkpoint:create',
)
const checkpointListForWork = scoped(
  rpc('checkpoint.list_for_work')
    .setPayload(WorkResumeListPayload)
    .setSuccess(Schema.Array(Checkpoint)),
  'workspace:read',
)
const checkpointLatestForWork = scoped(
  rpc('checkpoint.latest_for_work')
    .setPayload(WorkIdPayload)
    .setSuccess(Checkpoint),
  'workspace:read',
)
const checkpointListForWorkspace = scoped(
  rpc('checkpoint.list_for_workspace')
    .setPayload(WorkspaceResumeListPayload)
    .setSuccess(Schema.Array(Checkpoint)),
  'workspace:read',
)

const reviewRequest = scoped(
  rpc('review.request').setPayload(RequestReviewPayload).setSuccess(Review),
  'review:create',
)
const reviewApprove = scoped(
  rpc('review.approve').setPayload(ApproveReviewRpcPayload).setSuccess(Review),
  'review:approve',
)
const reviewReject = scoped(
  rpc('review.reject').setPayload(ReviewIdPayload).setSuccess(Review),
  'review:reject',
)
const reviewRequestChanges = scoped(
  rpc('review.request_changes').setPayload(ReviewIdPayload).setSuccess(Review),
  'review:request_changes',
)
const reviewCancel = scoped(
  rpc('review.cancel').setPayload(ReviewIdPayload).setSuccess(Review),
  'review:cancel',
)
const reviewListForWork = scoped(
  rpc('review.list_for_work')
    .setPayload(WorkResumeListPayload)
    .setSuccess(Schema.Array(Review)),
  'workspace:read',
)
const reviewListForWorkspace = scoped(
  rpc('review.list_for_workspace')
    .setPayload(WorkspaceResumeListPayload)
    .setSuccess(Schema.Array(Review)),
  'workspace:read',
)

const eventList = scoped(
  rpc('events.list')
    .setPayload(
      Schema.Struct({
        workspace_id: WorkspaceId,
        after_seq: Schema.Number,
      }),
    )
    .setSuccess(Schema.Array(Event)),
  'event:read',
)
const eventSubscribe = scoped(
  Rpc.make('events.subscribe', {
    payload: WorkspaceIdPayload,
    success: Event,
    error: ProtocolError,
    stream: true,
  }),
  'event:read',
)

const memoryCreate = scoped(
  rpc('memory.create').setPayload(CreateMemoryPayload).setSuccess(Memory),
  'memory:create',
)
const memoryList = scoped(
  rpc('memory.list')
    .setPayload(ReadMemoryQuery)
    .setSuccess(Schema.Array(Memory)),
  'memory:read',
)

export const AcpRpcs = {
  artifactContent,
  artifactCreate,
  artifactDelete,
  artifactListForWork,
  artifactListForWorkspace,
  artifactUpdate,
  checkpointCreate,
  checkpointLatestForWork,
  checkpointListForWork,
  checkpointListForWorkspace,
  eventList,
  eventSubscribe,
  leaseList,
  leaseRelease,
  leaseRenew,
  leaseRequest,
  leaseRevoke,
  memoryCreate,
  memoryList,
  reviewApprove,
  reviewCancel,
  reviewListForWork,
  reviewListForWorkspace,
  reviewReject,
  reviewRequest,
  reviewRequestChanges,
  sessionInitialize,
  workClaim,
  workCreate,
  workGet,
  workListForWorkspace,
  workPublishEvent,
  workerGet,
  workerList,
  workUpdateState,
  workspaceArchive,
  workspaceCreate,
  workspaceList,
  workspaceUpdate,
} as const

export const AcpRpcGroup = RpcGroup.make(
  sessionInitialize,
  workerList,
  workerGet,
  workspaceList,
  workspaceCreate,
  workspaceUpdate,
  workspaceArchive,
  workCreate,
  workListForWorkspace,
  workGet,
  workClaim,
  workUpdateState,
  workPublishEvent,
  leaseRequest,
  leaseList,
  leaseRenew,
  leaseRelease,
  leaseRevoke,
  artifactCreate,
  artifactUpdate,
  artifactDelete,
  artifactContent,
  artifactListForWork,
  artifactListForWorkspace,
  checkpointCreate,
  checkpointListForWork,
  checkpointLatestForWork,
  checkpointListForWorkspace,
  reviewRequest,
  reviewApprove,
  reviewReject,
  reviewRequestChanges,
  reviewCancel,
  reviewListForWork,
  reviewListForWorkspace,
  eventList,
  eventSubscribe,
  memoryCreate,
  memoryList,
)

export const acpRpcTags = [...AcpRpcGroup.requests.keys()].sort()
