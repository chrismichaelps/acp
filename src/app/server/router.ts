/** @Acp.App.Server.Router — HttpRouter binding the API contract to services */
import {
  Headers,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from '@effect/platform'
import { Effect, Option, Schema } from 'effect'
import { AppConfigTag } from '../../config/app-config.js'
import { ArtifactService } from '../../domain/artifacts/index.js'
import { CheckpointService } from '../../domain/checkpoints/index.js'
import { EventStore } from '../../domain/events/index.js'
import { LeaseService } from '../../domain/leases/index.js'
import { ReviewService } from '../../domain/reviews/index.js'
import { SessionService } from '../../domain/sessions/index.js'
import { WorkUnitService } from '../../domain/work-units/index.js'
import { WorkerService } from '../../domain/workers/index.js'
import { WorkspaceService } from '../../domain/workspaces/index.js'
import { toHttpErrorResponse } from '../../infrastructure/http/index.js'
import {
  ApproveReviewPayload,
  EventsStreamParams,
  InitializeSessionPayload,
  InitializeSessionResponse,
  PublishWorkEventPayload,
  UpdateWorkStatePayload,
} from '../../infrastructure/http/index.js'
import { workspaceSseResponse } from '../../infrastructure/sse/index.js'
import { makeRpcHandler } from './rpc-endpoint.js'
import { ValidationError } from '../../protocol/errors/protocol-error.js'
import type { DomainError } from '../../protocol/errors/protocol-error.js'
import {
  NotFoundError,
  UnauthorizedError,
} from '../../protocol/errors/protocol-error.js'
import {
  Artifact,
  Checkpoint,
  ClaimWorkPayload,
  CreateArtifactPayload,
  CreateCheckpointPayload,
  CreateWorkPayload,
  Event,
  Lease,
  RequestLeasePayload,
  RequestReviewPayload,
  Review,
  Workspace,
  WorkUnit,
} from '../../protocol/schema/index.js'
import type {
  ArtifactId,
  CheckpointId,
  EventId,
  LeaseId,
  Permission,
  ReviewId,
  SessionId,
  WorkerId,
  WorkId,
} from '../../protocol/schema/index.js'
import { IdClock } from './identity.js'

// Mutations without a resolvable session fall back to this fixed system actor.
const systemActor = 'worker_system' as WorkerId

// Static host identity + capabilities advertised at session/initialize (spec §9).
const host = { name: 'ACP Local', kind: 'local' } as const
const hostCapabilities = {
  supports_events: true,
  supports_reviews: true,
  supports_artifacts: true,
  supports_sse: true,
} as const

// Read the bearer token (session id) from the Authorization header, if present.
const bearerToken = Effect.map(HttpServerRequest.HttpServerRequest, (req) =>
  Option.match(Headers.get(req.headers, 'authorization'), {
    onNone: () => '',
    onSome: (header) =>
      header.toLowerCase().startsWith('bearer ')
        ? header.slice('bearer '.length).trim()
        : '',
  }),
)

// Resolve the acting worker and enforce the optional required scope (spec §8):
// - no bearer token → systemActor, unless AppConfig.requireAuth → 401 unauthorized;
// - token with no matching session → 401 unauthorized;
// - session missing the required scope → 401 unauthorized;
// - otherwise → the session's worker id.
const authorize = (scope?: Permission) =>
  Effect.gen(function* () {
    const token = yield* bearerToken
    if (token === '') {
      const config = yield* AppConfigTag
      if (config.requireAuth) {
        return yield* Effect.fail(
          new UnauthorizedError({ reason: 'authentication required' }),
        )
      }
      return systemActor
    }
    const sessions = yield* SessionService
    const session = yield* sessions.get(token as SessionId)
    return yield* Option.match(session, {
      onNone: () =>
        Effect.fail(new UnauthorizedError({ reason: 'invalid session token' })),
      onSome: (s) =>
        scope === undefined || s.permissions.includes(scope)
          ? Effect.succeed(s.worker_id)
          : Effect.fail(
              new UnauthorizedError({
                reason: `session lacks scope: ${scope}`,
              }),
            ),
    })
  })

const domainTags = new Set<string>([
  'ValidationError',
  'NotFoundError',
  'LeaseConflictError',
  'InvalidStateTransitionError',
  'UnauthorizedError',
  'UnsupportedCapabilityError',
  'StorageError',
])

const errorToResponse = (
  error: unknown,
): HttpServerResponse.HttpServerResponse => {
  const tag = (error as { readonly _tag?: string })._tag
  if (tag !== undefined && domainTags.has(tag)) {
    return toHttpErrorResponse(error as DomainError)
  }
  if (tag === 'ParseError' || tag === 'RequestError') {
    return toHttpErrorResponse(new ValidationError({ issues: [String(error)] }))
  }
  return HttpServerResponse.unsafeJson(
    { error: { code: 'internal_error', message: 'Internal error.' } },
    { status: 500 },
  )
}

const respond = <E, R>(
  effect: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
) => Effect.catchAll(effect, (error) => Effect.succeed(errorToResponse(error)))

const ok =
  (status: number) =>
  <A, I>(schema: Schema.Schema<A, I>, value: A) =>
    Effect.map(Schema.encode(schema)(value), (encoded) =>
      HttpServerResponse.unsafeJson(encoded, { status }),
    )

const pathParam = (key: string) =>
  Effect.map(HttpRouter.params, (params) => params[key] ?? '')

const initializeSession = respond(
  Effect.gen(function* () {
    const workers = yield* WorkerService
    const sessions = yield* SessionService
    const idClock = yield* IdClock
    const payload = yield* HttpServerRequest.schemaBodyJson(
      InitializeSessionPayload,
    )
    const worker = yield* workers.register(payload.worker)
    const sessionId = (yield* idClock.nextId('session')) as SessionId
    const now = yield* idClock.now
    yield* sessions.create({
      id: sessionId,
      worker_id: worker.id,
      created_at: now,
      permissions: payload.permissions,
    })
    return yield* ok(200)(InitializeSessionResponse, {
      session_id: sessionId,
      protocol_version: '0.1',
      host,
      capabilities: hostCapabilities,
    })
  }),
)

const listWorkspaces = respond(
  Effect.gen(function* () {
    const workspaces = yield* WorkspaceService
    yield* authorize('workspace:read')
    const all = yield* workspaces.list()
    return yield* ok(200)(Schema.Array(Workspace), all)
  }),
)

const createWork = respond(
  Effect.gen(function* () {
    const service = yield* WorkUnitService
    const idClock = yield* IdClock
    const payload = yield* HttpServerRequest.schemaBodyJson(CreateWorkPayload)
    const id = (yield* idClock.nextId('work')) as WorkId
    const now = yield* idClock.now
    const actor = yield* authorize('work:create')
    const work = yield* service.create({
      id,
      payload,
      createdBy: actor,
      now,
    })
    return yield* ok(201)(WorkUnit, work)
  }),
)

const claimWork = respond(
  Effect.gen(function* () {
    const service = yield* WorkUnitService
    const idClock = yield* IdClock
    const workId = (yield* pathParam('work_id')) as WorkId
    const payload = yield* HttpServerRequest.schemaBodyJson(ClaimWorkPayload)
    const now = yield* idClock.now
    yield* authorize('work:claim')
    const work = yield* service.claim(workId, payload.worker_id, now)
    return yield* ok(200)(WorkUnit, work)
  }),
)

const updateWorkState = respond(
  Effect.gen(function* () {
    const service = yield* WorkUnitService
    const idClock = yield* IdClock
    const workId = (yield* pathParam('work_id')) as WorkId
    const payload = yield* HttpServerRequest.schemaBodyJson(
      UpdateWorkStatePayload,
    )
    const now = yield* idClock.now
    const actor = yield* authorize()
    const work = yield* service.transition(workId, payload.state, actor, now)
    return yield* ok(200)(WorkUnit, work)
  }),
)

const publishWorkEvent = respond(
  Effect.gen(function* () {
    const service = yield* WorkUnitService
    const events = yield* EventStore
    const idClock = yield* IdClock
    const workId = (yield* pathParam('work_id')) as WorkId
    const payload = yield* HttpServerRequest.schemaBodyJson(
      PublishWorkEventPayload,
    )
    const stored = yield* service.get(workId)
    const work = yield* Option.match(stored, {
      onNone: () =>
        Effect.fail(new NotFoundError({ entity: 'work', id: workId })),
      onSome: Effect.succeed,
    })
    const id = (yield* idClock.nextId('event')) as EventId
    const now = yield* idClock.now
    const actor = yield* authorize()
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

const requestLease = respond(
  Effect.gen(function* () {
    const service = yield* LeaseService
    const idClock = yield* IdClock
    const payload = yield* HttpServerRequest.schemaBodyJson(RequestLeasePayload)
    const id = (yield* idClock.nextId('lease')) as LeaseId
    const now = yield* idClock.now
    yield* authorize('lease:create')
    const lease = yield* service.request({ id, payload, now })
    return yield* ok(201)(Lease, lease)
  }),
)

const releaseLease = respond(
  Effect.gen(function* () {
    const service = yield* LeaseService
    const idClock = yield* IdClock
    const leaseId = (yield* pathParam('lease_id')) as LeaseId
    const now = yield* idClock.now
    const actor = yield* authorize()
    yield* service.release(leaseId, actor, now)
    return HttpServerResponse.empty({ status: 204 })
  }),
)

const createArtifact = respond(
  Effect.gen(function* () {
    const service = yield* ArtifactService
    const idClock = yield* IdClock
    const payload = yield* HttpServerRequest.schemaBodyJson(
      CreateArtifactPayload,
    )
    const id = (yield* idClock.nextId('artifact')) as ArtifactId
    const now = yield* idClock.now
    const actor = yield* authorize('artifact:create')
    const artifact = yield* service.create({
      id,
      payload,
      createdBy: actor,
      now,
    })
    return yield* ok(201)(Artifact, artifact)
  }),
)

const createCheckpoint = respond(
  Effect.gen(function* () {
    const service = yield* CheckpointService
    const idClock = yield* IdClock
    const payload = yield* HttpServerRequest.schemaBodyJson(
      CreateCheckpointPayload,
    )
    const id = (yield* idClock.nextId('checkpoint')) as CheckpointId
    const now = yield* idClock.now
    const actor = yield* authorize('checkpoint:create')
    const checkpoint = yield* service.create({
      id,
      payload,
      createdBy: actor,
      now,
    })
    return yield* ok(201)(Checkpoint, checkpoint)
  }),
)

const requestReview = respond(
  Effect.gen(function* () {
    const service = yield* ReviewService
    const idClock = yield* IdClock
    const payload =
      yield* HttpServerRequest.schemaBodyJson(RequestReviewPayload)
    const id = (yield* idClock.nextId('review')) as ReviewId
    const now = yield* idClock.now
    yield* authorize('review:create')
    const review = yield* service.request({ id, payload, now })
    return yield* ok(201)(Review, review)
  }),
)

const approveReview = respond(
  Effect.gen(function* () {
    const service = yield* ReviewService
    const idClock = yield* IdClock
    const reviewId = (yield* pathParam('review_id')) as ReviewId
    const payload =
      yield* HttpServerRequest.schemaBodyJson(ApproveReviewPayload)
    const now = yield* idClock.now
    const actor = yield* authorize()
    const review = yield* service.approve(
      reviewId,
      actor,
      now,
      payload.met_requirements,
    )
    return yield* ok(200)(Review, review)
  }),
)

const rejectReview = respond(
  Effect.gen(function* () {
    const service = yield* ReviewService
    const idClock = yield* IdClock
    const reviewId = (yield* pathParam('review_id')) as ReviewId
    const now = yield* idClock.now
    const actor = yield* authorize()
    const review = yield* service.reject(reviewId, actor, now)
    return yield* ok(200)(Review, review)
  }),
)

const requestReviewChanges = respond(
  Effect.gen(function* () {
    const service = yield* ReviewService
    const idClock = yield* IdClock
    const reviewId = (yield* pathParam('review_id')) as ReviewId
    const now = yield* idClock.now
    const actor = yield* authorize()
    const review = yield* service.requestChanges(reviewId, actor, now)
    return yield* ok(200)(Review, review)
  }),
)

const streamEvents = respond(
  Effect.gen(function* () {
    const params =
      yield* HttpServerRequest.schemaSearchParams(EventsStreamParams)
    return yield* workspaceSseResponse(params.workspace_id)
  }),
)

// The canonical REST surface (spec §12). JSON-RPC dispatch replays against this.
const v1Router = HttpRouter.empty.pipe(
  HttpRouter.post('/v1/session/initialize', initializeSession),
  HttpRouter.get('/v1/workspaces', listWorkspaces),
  HttpRouter.post('/v1/work', createWork),
  HttpRouter.post('/v1/work/:work_id/claim', claimWork),
  HttpRouter.patch('/v1/work/:work_id', updateWorkState),
  HttpRouter.post('/v1/work/:work_id/events', publishWorkEvent),
  HttpRouter.post('/v1/leases', requestLease),
  HttpRouter.post('/v1/leases/:lease_id/release', releaseLease),
  HttpRouter.post('/v1/artifacts', createArtifact),
  HttpRouter.post('/v1/checkpoints', createCheckpoint),
  HttpRouter.post('/v1/reviews', requestReview),
  HttpRouter.post('/v1/reviews/:review_id/approve', approveReview),
  HttpRouter.post('/v1/reviews/:review_id/reject', rejectReview),
  HttpRouter.post(
    '/v1/reviews/:review_id/request_changes',
    requestReviewChanges,
  ),
  HttpRouter.get('/v1/events/stream', streamEvents),
)

// Add the spec §13 JSON-RPC framing, which dispatches into v1Router in the same
// service context (one shared store — no second AppLive).
export const acpRouter = v1Router.pipe(
  HttpRouter.post('/rpc', makeRpcHandler(v1Router)),
)
