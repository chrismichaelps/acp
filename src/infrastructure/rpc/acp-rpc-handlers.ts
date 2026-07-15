/** @Acp.Infra.Rpc.Handlers — native RPC domain handlers */
import { Effect, Layer, Option } from 'effect'
import { EventStore } from '../../domain/events/index.js'
import { LeaseService } from '../../domain/leases/index.js'
import { WorkUnitService } from '../../domain/work-units/index.js'
import { WorkerService } from '../../domain/workers/index.js'
import { WorkspaceService } from '../../domain/workspaces/index.js'
import { NotFoundError } from '../../protocol/errors/protocol-error.js'
import type {
  EventId,
  LeaseId,
  WorkId,
  WorkspaceId,
} from '../../protocol/schema/index.js'
import { IdClock } from '../../app/server/identity.js'
import { initializeSession } from '../../app/server/session-initializer.js'
import { bearerCredential } from '../auth/index.js'
import { AcpRpcGroup } from './acp-rpc-contract.js'
import { AcpRpcArtifactHandlersLive } from './acp-rpc-artifact-handlers.js'
import { AcpRpcCheckpointHandlersLive } from './acp-rpc-checkpoint-handlers.js'
import { AcpRpcMemoryEventHandlersLive } from './acp-rpc-memory-event-handlers.js'
import { AcpRpcReviewHandlersLive } from './acp-rpc-review-handlers.js'
import { rpcActor, rpcWorkspaceActor } from './rpc-auth.js'
import * as target from './rpc-resource-workspace-auth.js'
import { toRpcError } from './rpc-error.js'

const sessionInitializeHandler = AcpRpcGroup.toLayerHandler(
  'session.initialize',
  (payload, options) =>
    initializeSession(payload, bearerCredential(options.headers)).pipe(
      Effect.mapError(toRpcError),
    ),
)

const workerListHandler = AcpRpcGroup.toLayerHandler(
  'worker.list',
  (_payload, options) =>
    Effect.gen(function* () {
      yield* rpcActor(options.headers, 'worker:read')
      const workers = yield* WorkerService
      return yield* workers.list().pipe(Effect.mapError(toRpcError))
    }),
)

const workerGetHandler = AcpRpcGroup.toLayerHandler(
  'worker.get',
  (payload, options) =>
    Effect.gen(function* () {
      yield* rpcActor(options.headers, 'worker:read')
      const workers = yield* WorkerService
      const worker = yield* workers
        .get(payload.worker_id)
        .pipe(Effect.mapError(toRpcError))
      return yield* Option.match(worker, {
        onNone: () =>
          Effect.fail(
            toRpcError(
              new NotFoundError({
                entity: 'worker',
                id: payload.worker_id,
              }),
            ),
          ),
        onSome: Effect.succeed,
      })
    }),
)

const workspaceListHandler = AcpRpcGroup.toLayerHandler(
  'workspace.list',
  (_payload, options) =>
    Effect.gen(function* () {
      yield* rpcActor(options.headers, 'workspace:read')
      const workspaces = yield* WorkspaceService
      return yield* workspaces.list().pipe(Effect.mapError(toRpcError))
    }),
)

const workspaceCreateHandler = AcpRpcGroup.toLayerHandler(
  'workspace.create',
  (payload, options) =>
    Effect.gen(function* () {
      const actor = yield* rpcActor(options.headers, 'workspace:write')
      const workspaces = yield* WorkspaceService
      const idClock = yield* IdClock
      const id = (yield* idClock.nextId('workspace')) as WorkspaceId
      const now = yield* idClock.now
      return yield* workspaces
        .create({ id, state: 'active', ...payload }, actor, now)
        .pipe(Effect.mapError(toRpcError))
    }),
)

const workspaceUpdateHandler = AcpRpcGroup.toLayerHandler(
  'workspace.update',
  (payload, options) =>
    Effect.gen(function* () {
      const actor = yield* rpcWorkspaceActor(
        options.headers,
        'workspace:write',
        payload.workspace_id,
      )
      const workspaces = yield* WorkspaceService
      const idClock = yield* IdClock
      const now = yield* idClock.now
      return yield* workspaces
        .update(
          { ...payload, id: payload.workspace_id, state: 'active' },
          actor,
          now,
        )
        .pipe(Effect.mapError(toRpcError))
    }),
)

const workspaceArchiveHandler = AcpRpcGroup.toLayerHandler(
  'workspace.archive',
  (payload, options) =>
    Effect.gen(function* () {
      const actor = yield* rpcWorkspaceActor(
        options.headers,
        'workspace:write',
        payload.workspace_id,
      )
      const workspaces = yield* WorkspaceService
      const idClock = yield* IdClock
      const now = yield* idClock.now
      return yield* workspaces
        .archive(payload.workspace_id, actor, now)
        .pipe(Effect.mapError(toRpcError))
    }),
)

const workCreateHandler = AcpRpcGroup.toLayerHandler(
  'work.create',
  (payload, options) =>
    Effect.gen(function* () {
      const actor = yield* rpcWorkspaceActor(
        options.headers,
        'work:create',
        payload.workspace_id,
      )
      const service = yield* WorkUnitService
      const idClock = yield* IdClock
      const id = (yield* idClock.nextId('work')) as WorkId
      const now = yield* idClock.now
      return yield* service
        .create({ id, payload, createdBy: actor, now })
        .pipe(Effect.mapError(toRpcError))
    }),
)

const workListForWorkspaceHandler = AcpRpcGroup.toLayerHandler(
  'work.list_for_workspace',
  (payload, options) =>
    Effect.gen(function* () {
      yield* rpcWorkspaceActor(
        options.headers,
        'workspace:read',
        payload.workspace_id,
      )
      const service = yield* WorkUnitService
      return yield* service
        .listForWorkspace(payload.workspace_id)
        .pipe(Effect.mapError(toRpcError))
    }),
)

const workGetHandler = AcpRpcGroup.toLayerHandler(
  'work.get',
  (payload, options) =>
    Effect.gen(function* () {
      const { work } = yield* target.work(
        options.headers,
        'workspace:read',
        payload.work_id,
      )
      return work
    }),
)

const workClaimHandler = AcpRpcGroup.toLayerHandler(
  'work.claim',
  (payload, options) =>
    Effect.gen(function* () {
      yield* target.work(options.headers, 'work:claim', payload.work_id)
      const service = yield* WorkUnitService
      const idClock = yield* IdClock
      const now = yield* idClock.now
      return yield* service
        .claim(payload.work_id, payload.worker_id, now)
        .pipe(Effect.mapError(toRpcError))
    }),
)

const workUpdateStateHandler = AcpRpcGroup.toLayerHandler(
  'work.update_state',
  (payload, options) =>
    Effect.gen(function* () {
      const { actor } = yield* target.work(
        options.headers,
        'work:update',
        payload.work_id,
      )
      const service = yield* WorkUnitService
      const idClock = yield* IdClock
      const now = yield* idClock.now
      return yield* service
        .transition(payload.work_id, payload.state, actor, now)
        .pipe(Effect.mapError(toRpcError))
    }),
)

const workPublishEventHandler = AcpRpcGroup.toLayerHandler(
  'work.publish_event',
  (payload, options) =>
    Effect.gen(function* () {
      const events = yield* EventStore
      const idClock = yield* IdClock
      const { actor, work } = yield* target.work(
        options.headers,
        'work:publish_event',
        payload.work_id,
      )
      const id = (yield* idClock.nextId('event')) as EventId
      const now = yield* idClock.now
      return yield* events
        .append({
          id,
          type: payload.type,
          workspace_id: work.workspace_id,
          work_id: Option.some(work.id),
          actor,
          timestamp: now,
          data: payload.data,
        })
        .pipe(Effect.mapError(toRpcError))
    }),
)

const leaseRequestHandler = AcpRpcGroup.toLayerHandler(
  'lease.request',
  (payload, options) =>
    Effect.gen(function* () {
      yield* rpcWorkspaceActor(
        options.headers,
        'lease:create',
        payload.workspace_id,
      )
      const service = yield* LeaseService
      const idClock = yield* IdClock
      const id = (yield* idClock.nextId('lease')) as LeaseId
      const now = yield* idClock.now
      return yield* service
        .request({ id, payload, now })
        .pipe(Effect.mapError(toRpcError))
    }),
)

const leaseListHandler = AcpRpcGroup.toLayerHandler(
  'lease.list',
  (payload, options) =>
    Effect.gen(function* () {
      yield* rpcWorkspaceActor(
        options.headers,
        'workspace:read',
        payload.workspace_id,
      )
      const service = yield* LeaseService
      return yield* service
        .list(payload.workspace_id)
        .pipe(Effect.mapError(toRpcError))
    }),
)

const leaseRenewHandler = AcpRpcGroup.toLayerHandler(
  'lease.renew',
  (payload, options) =>
    Effect.gen(function* () {
      const { actor } = yield* target.lease(
        options.headers,
        'lease:renew',
        payload.lease_id,
      )
      const service = yield* LeaseService
      const idClock = yield* IdClock
      const now = yield* idClock.now
      return yield* service
        .renew(payload.lease_id, actor, now, payload.ttl_seconds)
        .pipe(Effect.mapError(toRpcError))
    }),
)

const leaseReleaseHandler = AcpRpcGroup.toLayerHandler(
  'lease.release',
  (payload, options) =>
    Effect.gen(function* () {
      const { actor } = yield* target.lease(
        options.headers,
        'lease:release',
        payload.lease_id,
      )
      const service = yield* LeaseService
      const idClock = yield* IdClock
      const now = yield* idClock.now
      yield* service
        .release(payload.lease_id, actor, now)
        .pipe(Effect.mapError(toRpcError))
    }),
)

const leaseRevokeHandler = AcpRpcGroup.toLayerHandler(
  'lease.revoke',
  (payload, options) =>
    Effect.gen(function* () {
      const { actor } = yield* target.lease(
        options.headers,
        'lease:revoke',
        payload.lease_id,
      )
      const service = yield* LeaseService
      const idClock = yield* IdClock
      const now = yield* idClock.now
      return yield* service
        .revoke(payload.lease_id, actor, now)
        .pipe(Effect.mapError(toRpcError))
    }),
)

export const AcpRpcSessionWorkerWorkspaceHandlersLive = Layer.mergeAll(
  sessionInitializeHandler,
  workerListHandler,
  workerGetHandler,
  workspaceListHandler,
  workspaceCreateHandler,
  workspaceUpdateHandler,
  workspaceArchiveHandler,
  workCreateHandler,
  workListForWorkspaceHandler,
  workGetHandler,
  workClaimHandler,
  workUpdateStateHandler,
  workPublishEventHandler,
  leaseRequestHandler,
  leaseListHandler,
  leaseRenewHandler,
  leaseReleaseHandler,
  leaseRevokeHandler,
  AcpRpcArtifactHandlersLive,
  AcpRpcCheckpointHandlersLive,
  AcpRpcReviewHandlersLive,
  AcpRpcMemoryEventHandlersLive,
)
