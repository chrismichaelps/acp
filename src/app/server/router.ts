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
import { ReviewService } from '../../domain/reviews/index.js'
import { WorkUnitService } from '../../domain/work-units/index.js'
import { WorkerService } from '../../domain/workers/index.js'
import { WorkspaceService } from '../../domain/workspaces/index.js'
import { toHttpErrorResponse } from '../../infrastructure/http/index.js'
import {
  EventsStreamParams,
  InitializeSessionPayload,
  InitializeSessionResponse,
  PublishWorkEventPayload,
  UpdateWorkStatePayload,
} from '../../infrastructure/http/index.js'
import { workspaceSseResponse } from '../../infrastructure/sse/index.js'
import { ValidationError } from '../../protocol/errors/protocol-error.js'
import type { DomainError } from '../../protocol/errors/protocol-error.js'
import { NotFoundError } from '../../protocol/errors/protocol-error.js'
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
  ReviewId,
  WorkerId,
  WorkId,
} from '../../protocol/schema/index.js'
import { IdClock } from './identity.js'

// Unattributed mutations use a fixed system actor until session auth lands.
const systemActor = 'worker_system' as WorkerId

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
    const payload = yield* HttpServerRequest.schemaBodyJson(
      InitializeSessionPayload,
    )
    const worker = yield* workers.register(payload.worker)
    return yield* ok(200)(InitializeSessionResponse, {
      worker,
      capabilities: worker.capabilities,
    })
  }),
)

const listWorkspaces = respond(
  Effect.gen(function* () {
    const workspaces = yield* WorkspaceService
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
    const work = yield* service.create({
      id,
      payload,
      createdBy: systemActor,
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
    const work = yield* service.transition(
      workId,
      payload.state,
      systemActor,
      now,
    )
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
    const event = yield* events.append({
      id,
      type: payload.type,
      workspace_id: work.workspace_id,
      work_id: Option.some(work.id),
      actor: systemActor,
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
    yield* service.release(leaseId, systemActor, now)
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
    const artifact = yield* service.create({
      id,
      payload,
      createdBy: systemActor,
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
    const checkpoint = yield* service.create({
      id,
      payload,
      createdBy: systemActor,
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
    const review = yield* service.request({ id, payload, now })
    return yield* ok(201)(Review, review)
  }),
)

const streamEvents = respond(
  Effect.gen(function* () {
    const params =
      yield* HttpServerRequest.schemaSearchParams(EventsStreamParams)
    return yield* workspaceSseResponse(params.workspace_id)
  }),
)

export const acpRouter = HttpRouter.empty.pipe(
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
  HttpRouter.get('/v1/events/stream', streamEvents),
)
