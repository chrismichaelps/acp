/** @Acp.App.Server.Router — HttpRouter binding the API contract to services */
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from '@effect/platform'
import { Effect, Option, Schema } from 'effect'
import { ArtifactService } from '../../domain/artifacts/index.js'
import { CheckpointService } from '../../domain/checkpoints/index.js'
import { EventStore } from '../../domain/events/index.js'
import { LeaseService } from '../../domain/leases/index.js'
import { SessionService } from '../../domain/sessions/index.js'
import { WorkUnitService } from '../../domain/work-units/index.js'
import { WorkerService } from '../../domain/workers/index.js'
import {
  InitializeSessionPayload,
  InitializeSessionResponse,
  LeaseListParams,
  PublishWorkEventPayload,
  RenewLeasePayload,
  UpdateWorkStatePayload,
} from '../../infrastructure/http/index.js'
import { replayEvents, streamEvents } from './event-routes.js'
import { livenessProbe, readinessProbe } from './health-routes.js'
import {
  getWork,
  getArtifactContent,
  getWorkResumePacket,
  latestWorkCheckpoint,
  listWorkArtifacts,
  listWorkCheckpoints,
  listWorkReviews,
} from './resume-routes.js'
import { createMemory, listMemory } from './memory-routes.js'
import {
  addReviewComment,
  listReviewComments,
  listWorkReviewComments,
  reopenReviewComment,
  resolveReviewComment,
} from './review-comment-routes.js'
import {
  addGrillQuestion,
  answerGrillQuestion,
  evaluateGrill,
  getGrill,
  listReviewGrills,
  openGrill,
  setGrillVerdict,
} from './grill-routes.js'
import {
  approveReview,
  cancelReview,
  rejectReview,
  requestReview,
  requestReviewChanges,
} from './review-routes.js'
import { makeRpcHandler } from './rpc-endpoint.js'
import { makeRpcSocketHandler } from './rpc-socket.js'
import { ValidationError } from '../../protocol/errors/protocol-error.js'
import {
  ACP_PROTOCOL_VERSION,
  Artifact,
  Checkpoint,
  ClaimWorkPayload,
  CreateArtifactPayload,
  CreateCheckpointPayload,
  CreateWorkPayload,
  Event,
  Lease,
  RequestLeasePayload,
  UpdateArtifactPayload,
  WorkUnit,
  isSupportedProtocolVersion,
} from '../../protocol/schema/index.js'
import type {
  ArtifactId,
  Capability,
  CheckpointId,
  EventId,
  LeaseId,
  SessionId,
  WorkId,
} from '../../protocol/schema/index.js'
import { IdClock } from './identity.js'
import {
  authorizeWorkspace as authorizeWs,
  ok,
  pathParam,
  requireSessionWorkspaceBinding,
  respond,
} from './route-support.js'
import * as target from './resource-workspace-auth.js'
import {
  archiveWorkspace,
  createWorkspace,
  listWorkspaceArtifacts,
  listWorkspaceCheckpoints,
  listWorkspaceReviews,
  listWorkspaceWork,
  listWorkspaces,
  updateWorkspace,
} from './workspace-routes.js'
import { getWorker, listWorkers } from './worker-routes.js'

// Static host identity + capabilities advertised at session/initialize (spec §9).
const host = { name: 'ACP Local', kind: 'local' } as const
const hostCapabilities = {
  supports_events: true,
  supports_reviews: true,
  supports_signed_review_approvals: true,
  supports_artifacts: true,
  supports_memory: true,
  supports_sse: true,
} as const

const capabilityFlags: readonly (readonly [
  keyof InitializeSessionPayload['capabilities'],
  Capability,
])[] = [
  ['can_edit_files', 'can_edit_files'],
  ['can_run_commands', 'can_run_commands'],
  ['can_create_prs', 'can_create_prs'],
  ['can_review', 'can_review'],
  ['supports_checkpoints', 'supports_checkpoints'],
  ['supports_leases', 'supports_leases'],
]

const capabilitiesFromHandshake = (
  payload: InitializeSessionPayload,
): readonly Capability[] => {
  if (payload.worker.capabilities.length > 0) {
    return payload.worker.capabilities
  }
  return capabilityFlags.flatMap(([flag, capability]) =>
    payload.capabilities[flag] ? [capability] : [],
  )
}

const initializeSession = respond('POST /v1/session/initialize')(
  Effect.gen(function* () {
    const workers = yield* WorkerService
    const sessions = yield* SessionService
    const idClock = yield* IdClock
    const payload = yield* HttpServerRequest.schemaBodyJson(
      InitializeSessionPayload,
    )
    if (!isSupportedProtocolVersion(payload.protocol_version)) {
      return yield* Effect.fail(
        new ValidationError({
          issues: [`unsupported protocol_version: ${payload.protocol_version}`],
        }),
      )
    }
    yield* requireSessionWorkspaceBinding(payload.workspace_ids)
    const worker = yield* workers.register({
      ...payload.worker,
      capabilities: [...capabilitiesFromHandshake(payload)],
    })
    const sessionId = (yield* idClock.secureToken('session')) as SessionId
    const now = yield* idClock.now
    yield* sessions.create({
      id: sessionId,
      worker_id: worker.id,
      created_at: now,
      permissions: payload.permissions,
      workspace_ids: payload.workspace_ids,
    })
    return yield* ok(200)(InitializeSessionResponse, {
      session_id: sessionId,
      protocol_version: ACP_PROTOCOL_VERSION,
      host,
      capabilities: hostCapabilities,
    })
  }),
)

const createWork = respond('POST /v1/work')(
  Effect.gen(function* () {
    const service = yield* WorkUnitService
    const idClock = yield* IdClock
    const payload = yield* HttpServerRequest.schemaBodyJson(CreateWorkPayload)
    const id = (yield* idClock.nextId('work')) as WorkId
    const now = yield* idClock.now
    const actor = yield* authorizeWs('work:create', payload.workspace_id)
    const work = yield* service.create({
      id,
      payload,
      createdBy: actor,
      now,
    })
    return yield* ok(201)(WorkUnit, work)
  }),
)

const claimWork = respond('POST /v1/work/:work_id/claim')(
  Effect.gen(function* () {
    const service = yield* WorkUnitService
    const idClock = yield* IdClock
    const workId = (yield* pathParam('work_id')) as WorkId
    const payload = yield* HttpServerRequest.schemaBodyJson(ClaimWorkPayload)
    const now = yield* idClock.now
    yield* target.work('work:claim', workId)
    const work = yield* service.claim(workId, payload.worker_id, now)
    return yield* ok(200)(WorkUnit, work)
  }),
)

const updateWorkState = respond('PATCH /v1/work/:work_id')(
  Effect.gen(function* () {
    const service = yield* WorkUnitService
    const idClock = yield* IdClock
    const workId = (yield* pathParam('work_id')) as WorkId
    const payload = yield* HttpServerRequest.schemaBodyJson(
      UpdateWorkStatePayload,
    )
    const now = yield* idClock.now
    const { actor } = yield* target.work('work:update', workId)
    const work = yield* service.transition(workId, payload.state, actor, now)
    return yield* ok(200)(WorkUnit, work)
  }),
)

const publishWorkEvent = respond('POST /v1/work/:work_id/events')(
  Effect.gen(function* () {
    const events = yield* EventStore
    const idClock = yield* IdClock
    const workId = (yield* pathParam('work_id')) as WorkId
    const payload = yield* HttpServerRequest.schemaBodyJson(
      PublishWorkEventPayload,
    )
    const { actor, work } = yield* target.work('work:publish_event', workId)
    const id = (yield* idClock.nextId('event')) as EventId
    const now = yield* idClock.now
    const event = yield* events.append({
      id,
      type: payload.type,
      workspace_id: work.workspace_id,
      work_id: Option.some(work.id),
      actor,
      timestamp: now,
      data: payload.data,
    })
    return yield* ok(201)(Event, event)
  }),
)

const requestLease = respond('POST /v1/leases')(
  Effect.gen(function* () {
    const service = yield* LeaseService
    const idClock = yield* IdClock
    const payload = yield* HttpServerRequest.schemaBodyJson(RequestLeasePayload)
    const id = (yield* idClock.nextId('lease')) as LeaseId
    const now = yield* idClock.now
    yield* authorizeWs('lease:create', payload.workspace_id)
    const lease = yield* service.request({ id, payload, now })
    return yield* ok(201)(Lease, lease)
  }),
)

const listLeases = respond('GET /v1/leases')(
  Effect.gen(function* () {
    const service = yield* LeaseService
    const params = yield* HttpServerRequest.schemaSearchParams(LeaseListParams)
    yield* authorizeWs('workspace:read', params.workspace_id)
    const leases = yield* service.list(params.workspace_id)
    return yield* ok(200)(Schema.Array(Lease), leases)
  }),
)

const releaseLease = respond('POST /v1/leases/:lease_id/release')(
  Effect.gen(function* () {
    const service = yield* LeaseService
    const idClock = yield* IdClock
    const leaseId = (yield* pathParam('lease_id')) as LeaseId
    const now = yield* idClock.now
    const { actor } = yield* target.lease('lease:release', leaseId)
    yield* service.release(leaseId, actor, now)
    return HttpServerResponse.empty({ status: 204 })
  }),
)

const renewLease = respond('POST /v1/leases/:lease_id/renew')(
  Effect.gen(function* () {
    const service = yield* LeaseService
    const idClock = yield* IdClock
    const leaseId = (yield* pathParam('lease_id')) as LeaseId
    const payload = yield* HttpServerRequest.schemaBodyJson(RenewLeasePayload)
    const now = yield* idClock.now
    const { actor } = yield* target.lease('lease:renew', leaseId)
    const lease = yield* service.renew(leaseId, actor, now, payload.ttl_seconds)
    return yield* ok(200)(Lease, lease)
  }),
)

const revokeLease = respond('POST /v1/leases/:lease_id/revoke')(
  Effect.gen(function* () {
    const service = yield* LeaseService
    const idClock = yield* IdClock
    const leaseId = (yield* pathParam('lease_id')) as LeaseId
    const now = yield* idClock.now
    const { actor } = yield* target.lease('lease:revoke', leaseId)
    const lease = yield* service.revoke(leaseId, actor, now)
    return yield* ok(200)(Lease, lease)
  }),
)

const createArtifact = respond('POST /v1/artifacts')(
  Effect.gen(function* () {
    const service = yield* ArtifactService
    const idClock = yield* IdClock
    const payload = yield* HttpServerRequest.schemaBodyJson(
      CreateArtifactPayload,
    )
    const id = (yield* idClock.nextId('artifact')) as ArtifactId
    const now = yield* idClock.now
    const actor = yield* authorizeWs('artifact:create', payload.workspace_id)
    const artifact = yield* service.create({
      id,
      payload,
      createdBy: actor,
      now,
    })
    return yield* ok(201)(Artifact, artifact)
  }),
)

const deleteArtifact = respond('DELETE /v1/artifacts/:artifact_id')(
  Effect.gen(function* () {
    const service = yield* ArtifactService
    const idClock = yield* IdClock
    const artifactId = (yield* pathParam('artifact_id')) as ArtifactId
    const now = yield* idClock.now
    const { actor } = yield* target.artifact('artifact:delete', artifactId)
    const artifact = yield* service.remove(artifactId, actor, now)
    return yield* ok(200)(Artifact, artifact)
  }),
)

const updateArtifact = respond('PATCH /v1/artifacts/:artifact_id')(
  Effect.gen(function* () {
    const service = yield* ArtifactService
    const idClock = yield* IdClock
    const artifactId = (yield* pathParam('artifact_id')) as ArtifactId
    const payload = yield* HttpServerRequest.schemaBodyJson(
      UpdateArtifactPayload,
    )
    const now = yield* idClock.now
    const { actor } = yield* target.artifact('artifact:update', artifactId)
    const artifact = yield* service.update(artifactId, payload, actor, now)
    return yield* ok(200)(Artifact, artifact)
  }),
)

const createCheckpoint = respond('POST /v1/checkpoints')(
  Effect.gen(function* () {
    const service = yield* CheckpointService
    const idClock = yield* IdClock
    const payload = yield* HttpServerRequest.schemaBodyJson(
      CreateCheckpointPayload,
    )
    const id = (yield* idClock.nextId('checkpoint')) as CheckpointId
    const now = yield* idClock.now
    const actor = yield* authorizeWs('checkpoint:create', payload.workspace_id)
    const checkpoint = yield* service.create({
      id,
      payload,
      createdBy: actor,
      now,
    })
    return yield* ok(201)(Checkpoint, checkpoint)
  }),
)

// The canonical REST surface (spec §12). JSON-RPC dispatch replays against this.
const workRouter = HttpRouter.empty.pipe(
  HttpRouter.post('/v1/session/initialize', initializeSession),
  HttpRouter.get('/v1/workers', listWorkers),
  HttpRouter.get('/v1/workers/:worker_id', getWorker),
  HttpRouter.get('/v1/workspaces', listWorkspaces),
  HttpRouter.post('/v1/workspaces', createWorkspace),
  HttpRouter.patch('/v1/workspaces/:workspace_id', updateWorkspace),
  HttpRouter.get('/v1/workspaces/:workspace_id/work', listWorkspaceWork),
  HttpRouter.get(
    '/v1/workspaces/:workspace_id/checkpoints',
    listWorkspaceCheckpoints,
  ),
  HttpRouter.get(
    '/v1/workspaces/:workspace_id/artifacts',
    listWorkspaceArtifacts,
  ),
  HttpRouter.get('/v1/workspaces/:workspace_id/reviews', listWorkspaceReviews),
  HttpRouter.post('/v1/workspaces/:workspace_id/archive', archiveWorkspace),
  HttpRouter.post('/v1/work', createWork),
  HttpRouter.get('/v1/work/:work_id', getWork),
  HttpRouter.post('/v1/work/:work_id/claim', claimWork),
  HttpRouter.patch('/v1/work/:work_id', updateWorkState),
  HttpRouter.post('/v1/work/:work_id/events', publishWorkEvent),
  HttpRouter.get('/v1/work/:work_id/checkpoints', listWorkCheckpoints),
  HttpRouter.get('/v1/work/:work_id/checkpoints/latest', latestWorkCheckpoint),
  HttpRouter.get('/v1/work/:work_id/artifacts', listWorkArtifacts),
  HttpRouter.get('/v1/work/:work_id/reviews', listWorkReviews),
)

const resumeRouter = workRouter.pipe(
  HttpRouter.get('/v1/work/:work_id/resume', getWorkResumePacket),
)

const leaseRouter = resumeRouter.pipe(
  HttpRouter.get('/v1/leases', listLeases),
  HttpRouter.post('/v1/leases', requestLease),
  HttpRouter.post('/v1/leases/:lease_id/renew', renewLease),
  HttpRouter.post('/v1/leases/:lease_id/release', releaseLease),
  HttpRouter.post('/v1/leases/:lease_id/revoke', revokeLease),
)

const commandRouter = leaseRouter.pipe(
  HttpRouter.post('/v1/artifacts', createArtifact),
  HttpRouter.patch('/v1/artifacts/:artifact_id', updateArtifact),
  HttpRouter.del('/v1/artifacts/:artifact_id', deleteArtifact),
  HttpRouter.get('/v1/artifacts/:artifact_id/content', getArtifactContent),
  HttpRouter.post('/v1/checkpoints', createCheckpoint),
  HttpRouter.post('/v1/memory', createMemory),
  HttpRouter.get('/v1/memory', listMemory),
  HttpRouter.post('/v1/reviews', requestReview),
  HttpRouter.post('/v1/reviews/:review_id/approve', approveReview),
)

const v1Router = commandRouter.pipe(
  HttpRouter.post('/v1/reviews/:review_id/reject', rejectReview),
  HttpRouter.post(
    '/v1/reviews/:review_id/request_changes',
    requestReviewChanges,
  ),
  HttpRouter.post('/v1/reviews/:review_id/cancel', cancelReview),
  HttpRouter.post('/v1/reviews/:review_id/comments', addReviewComment),
  HttpRouter.get('/v1/reviews/:review_id/comments', listReviewComments),
  HttpRouter.post(
    '/v1/review-comments/:comment_id/resolve',
    resolveReviewComment,
  ),
  HttpRouter.post(
    '/v1/review-comments/:comment_id/reopen',
    reopenReviewComment,
  ),
  HttpRouter.get('/v1/work/:work_id/review-comments', listWorkReviewComments),
  HttpRouter.post('/v1/reviews/:review_id/grill', openGrill),
  HttpRouter.get('/v1/reviews/:review_id/grills', listReviewGrills),
  HttpRouter.post('/v1/grills/:grill_id/questions', addGrillQuestion),
  HttpRouter.post('/v1/grills/:grill_id/evaluate', evaluateGrill),
  HttpRouter.get('/v1/grills/:grill_id', getGrill),
  HttpRouter.post(
    '/v1/grill-questions/:question_id/answer',
    answerGrillQuestion,
  ),
  HttpRouter.post('/v1/grill-questions/:question_id/verdict', setGrillVerdict),
  HttpRouter.get('/v1/events', replayEvents),
  HttpRouter.get('/v1/events/stream', streamEvents),
)

export const acpRouter = v1Router.pipe(
  HttpRouter.get('/health', livenessProbe),
  HttpRouter.get('/ready', readinessProbe),
  HttpRouter.post('/rpc', makeRpcHandler(v1Router)),
  HttpRouter.get('/rpc', makeRpcSocketHandler(v1Router)),
)
