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
import {
  ApproveReviewPayload,
  ArtifactContentResponse,
  InitializeSessionPayload,
  InitializeSessionResponse,
  PublishWorkEventPayload,
  RenewLeasePayload,
  UpdateWorkStatePayload,
} from '../http/acp-http-api.js'

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

const workerList = rpc('worker.list').setSuccess(Schema.Array(Worker))
const workerGet = rpc('worker.get')
  .setPayload(WorkerIdPayload)
  .setSuccess(Worker)

const sessionInitialize = rpc('session.initialize')
  .setPayload(InitializeSessionPayload)
  .setSuccess(InitializeSessionResponse)

const workspaceList = rpc('workspace.list').setSuccess(Schema.Array(Workspace))
const workspaceCreate = rpc('workspace.create')
  .setPayload(CreateWorkspacePayload)
  .setSuccess(Workspace)
const workspaceUpdate = rpc('workspace.update')
  .setPayload(UpdateWorkspaceRpcPayload)
  .setSuccess(Workspace)
const workspaceArchive = rpc('workspace.archive')
  .setPayload(WorkspaceIdPayload)
  .setSuccess(Workspace)

const workCreate = rpc('work.create')
  .setPayload(CreateWorkPayload)
  .setSuccess(WorkUnit)
const workListForWorkspace = rpc('work.list_for_workspace')
  .setPayload(WorkspaceWorkListPayload)
  .setSuccess(Schema.Array(WorkUnit))
const workGet = rpc('work.get').setPayload(WorkIdPayload).setSuccess(WorkUnit)
const workClaim = rpc('work.claim')
  .setPayload(ClaimWorkRpcPayload)
  .setSuccess(WorkUnit)
const workUpdateState = rpc('work.update_state')
  .setPayload(UpdateWorkStateRpcPayload)
  .setSuccess(WorkUnit)
const workPublishEvent = rpc('work.publish_event')
  .setPayload(PublishWorkEventRpcPayload)
  .setSuccess(Event)

const leaseRequest = rpc('lease.request')
  .setPayload(RequestLeasePayload)
  .setSuccess(Lease)
const leaseRenew = rpc('lease.renew')
  .setPayload(LeaseRenewRpcPayload)
  .setSuccess(Lease)
const leaseRelease = rpc('lease.release')
  .setPayload(LeaseIdPayload)
  .setSuccess(Schema.Void)
const leaseRevoke = rpc('lease.revoke')
  .setPayload(LeaseIdPayload)
  .setSuccess(Lease)

const artifactCreate = rpc('artifact.create')
  .setPayload(CreateArtifactPayload)
  .setSuccess(Artifact)
const artifactUpdate = rpc('artifact.update')
  .setPayload(UpdateArtifactRpcPayload)
  .setSuccess(Artifact)
const artifactDelete = rpc('artifact.delete')
  .setPayload(ArtifactIdPayload)
  .setSuccess(Artifact)
const artifactContent = rpc('artifact.content')
  .setPayload(ArtifactIdPayload)
  .setSuccess(ArtifactContentResponse)
const artifactListForWork = rpc('artifact.list_for_work')
  .setPayload(WorkResumeListPayload)
  .setSuccess(Schema.Array(Artifact))
const artifactListForWorkspace = rpc('artifact.list_for_workspace')
  .setPayload(WorkspaceResumeListPayload)
  .setSuccess(Schema.Array(Artifact))

const checkpointCreate = rpc('checkpoint.create')
  .setPayload(CreateCheckpointPayload)
  .setSuccess(Checkpoint)
const checkpointListForWork = rpc('checkpoint.list_for_work')
  .setPayload(WorkResumeListPayload)
  .setSuccess(Schema.Array(Checkpoint))
const checkpointLatestForWork = rpc('checkpoint.latest_for_work')
  .setPayload(WorkIdPayload)
  .setSuccess(Checkpoint)
const checkpointListForWorkspace = rpc('checkpoint.list_for_workspace')
  .setPayload(WorkspaceResumeListPayload)
  .setSuccess(Schema.Array(Checkpoint))

const reviewRequest = rpc('review.request')
  .setPayload(RequestReviewPayload)
  .setSuccess(Review)
const reviewApprove = rpc('review.approve')
  .setPayload(ApproveReviewRpcPayload)
  .setSuccess(Review)
const reviewReject = rpc('review.reject')
  .setPayload(ReviewIdPayload)
  .setSuccess(Review)
const reviewRequestChanges = rpc('review.request_changes')
  .setPayload(ReviewIdPayload)
  .setSuccess(Review)
const reviewCancel = rpc('review.cancel')
  .setPayload(ReviewIdPayload)
  .setSuccess(Review)
const reviewListForWork = rpc('review.list_for_work')
  .setPayload(WorkResumeListPayload)
  .setSuccess(Schema.Array(Review))
const reviewListForWorkspace = rpc('review.list_for_workspace')
  .setPayload(WorkspaceResumeListPayload)
  .setSuccess(Schema.Array(Review))

const eventList = rpc('events.list')
  .setPayload(
    Schema.Struct({
      workspace_id: WorkspaceId,
      after_seq: Schema.Number,
    }),
  )
  .setSuccess(Schema.Array(Event))

const memoryCreate = rpc('memory.create')
  .setPayload(CreateMemoryPayload)
  .setSuccess(Memory)
const memoryList = rpc('memory.list')
  .setPayload(ReadMemoryQuery)
  .setSuccess(Schema.Array(Memory))

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
  memoryCreate,
  memoryList,
)

export const acpRpcTags = [...AcpRpcGroup.requests.keys()].sort()
