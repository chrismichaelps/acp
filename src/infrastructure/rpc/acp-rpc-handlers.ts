/** @Acp.Infra.Rpc.Handlers — native RPC domain handlers */
import { Effect, Layer, Option } from 'effect'
import { EventStore } from '../../domain/events/index.js'
import { LeaseService } from '../../domain/leases/index.js'
import { SessionService } from '../../domain/sessions/index.js'
import { WorkUnitService } from '../../domain/work-units/index.js'
import { WorkerService } from '../../domain/workers/index.js'
import { WorkspaceService } from '../../domain/workspaces/index.js'
import {
  NotFoundError,
  ValidationError,
} from '../../protocol/errors/protocol-error.js'
import {
  ACP_PROTOCOL_VERSION,
  isSupportedProtocolVersion,
} from '../../protocol/schema/index.js'
import type {
  Capability,
  EventId,
  LeaseId,
  SessionId,
  WorkId,
  WorkspaceId,
} from '../../protocol/schema/index.js'
import type { InitializeSessionPayload } from '../http/acp-http-api.js'
import { IdClock } from '../../app/server/identity.js'
import { AcpRpcGroup } from './acp-rpc-contract.js'
import { AcpRpcArtifactHandlersLive } from './acp-rpc-artifact-handlers.js'
import { AcpRpcCheckpointHandlersLive } from './acp-rpc-checkpoint-handlers.js'
import { authorizeRpc } from './rpc-auth.js'
import { toRpcError } from './rpc-error.js'

const host = { name: 'ACP Local', kind: 'local' } as const
const hostCapabilities = {
  supports_events: true,
  supports_reviews: true,
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

const sessionInitializeHandler = AcpRpcGroup.toLayerHandler(
  'session.initialize',
  (payload) =>
    Effect.gen(function* () {
      if (!isSupportedProtocolVersion(payload.protocol_version)) {
        return yield* Effect.fail(
          toRpcError(
            new ValidationError({
              issues: [
                `unsupported protocol_version: ${payload.protocol_version}`,
              ],
            }),
          ),
        )
      }

      const workers = yield* WorkerService
      const sessions = yield* SessionService
      const idClock = yield* IdClock
      const worker = yield* workers
        .register({
          ...payload.worker,
          capabilities: [...capabilitiesFromHandshake(payload)],
        })
        .pipe(Effect.mapError(toRpcError))
      const sessionId = (yield* idClock.nextId('session')) as SessionId
      const now = yield* idClock.now
      yield* sessions
        .create({
          id: sessionId,
          worker_id: worker.id,
          created_at: now,
          permissions: payload.permissions,
        })
        .pipe(Effect.mapError(toRpcError))

      return {
        session_id: sessionId,
        protocol_version: ACP_PROTOCOL_VERSION,
        host,
        capabilities: hostCapabilities,
      }
    }),
)

const workerListHandler = AcpRpcGroup.toLayerHandler(
  'worker.list',
  (_payload, options) =>
    Effect.gen(function* () {
      yield* authorizeRpc(options.headers, 'worker:read')
      const workers = yield* WorkerService
      return yield* workers.list().pipe(Effect.mapError(toRpcError))
    }),
)

const workerGetHandler = AcpRpcGroup.toLayerHandler(
  'worker.get',
  (payload, options) =>
    Effect.gen(function* () {
      yield* authorizeRpc(options.headers, 'worker:read')
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
      yield* authorizeRpc(options.headers, 'workspace:read')
      const workspaces = yield* WorkspaceService
      return yield* workspaces.list().pipe(Effect.mapError(toRpcError))
    }),
)

const workspaceCreateHandler = AcpRpcGroup.toLayerHandler(
  'workspace.create',
  (payload, options) =>
    Effect.gen(function* () {
      const actor = yield* authorizeRpc(options.headers, 'workspace:write')
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
      const actor = yield* authorizeRpc(options.headers, 'workspace:write')
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
      const actor = yield* authorizeRpc(options.headers, 'workspace:write')
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
      const actor = yield* authorizeRpc(options.headers, 'work:create')
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
      yield* authorizeRpc(options.headers, 'workspace:read')
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
      yield* authorizeRpc(options.headers, 'workspace:read')
      const service = yield* WorkUnitService
      const work = yield* service
        .get(payload.work_id)
        .pipe(Effect.mapError(toRpcError))
      return yield* Option.match(work, {
        onNone: () =>
          Effect.fail(
            toRpcError(
              new NotFoundError({ entity: 'work', id: payload.work_id }),
            ),
          ),
        onSome: Effect.succeed,
      })
    }),
)

const workClaimHandler = AcpRpcGroup.toLayerHandler(
  'work.claim',
  (payload, options) =>
    Effect.gen(function* () {
      yield* authorizeRpc(options.headers, 'work:claim')
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
      const actor = yield* authorizeRpc(options.headers, 'work:update')
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
      const actor = yield* authorizeRpc(options.headers, 'work:publish_event')
      const service = yield* WorkUnitService
      const events = yield* EventStore
      const idClock = yield* IdClock
      const stored = yield* service
        .get(payload.work_id)
        .pipe(Effect.mapError(toRpcError))
      const work = yield* Option.match(stored, {
        onNone: () =>
          Effect.fail(
            toRpcError(
              new NotFoundError({ entity: 'work', id: payload.work_id }),
            ),
          ),
        onSome: Effect.succeed,
      })
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
      yield* authorizeRpc(options.headers, 'lease:create')
      const service = yield* LeaseService
      const idClock = yield* IdClock
      const id = (yield* idClock.nextId('lease')) as LeaseId
      const now = yield* idClock.now
      return yield* service
        .request({ id, payload, now })
        .pipe(Effect.mapError(toRpcError))
    }),
)

const leaseRenewHandler = AcpRpcGroup.toLayerHandler(
  'lease.renew',
  (payload, options) =>
    Effect.gen(function* () {
      const actor = yield* authorizeRpc(options.headers, 'lease:renew')
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
      const actor = yield* authorizeRpc(options.headers, 'lease:release')
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
      const actor = yield* authorizeRpc(options.headers, 'lease:revoke')
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
  leaseRenewHandler,
  leaseReleaseHandler,
  leaseRevokeHandler,
  AcpRpcArtifactHandlersLive,
  AcpRpcCheckpointHandlersLive,
)
