/** @Acp.Infra.Rpc.Handlers — first native RPC handler vertical */
import { Effect, Layer, Option } from 'effect'
import { SessionService } from '../../domain/sessions/index.js'
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
import type { Capability, SessionId } from '../../protocol/schema/index.js'
import type { InitializeSessionPayload } from '../http/acp-http-api.js'
import { IdClock } from '../../app/server/identity.js'
import { AcpRpcGroup } from './acp-rpc-contract.js'
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

export const AcpRpcSessionWorkerWorkspaceHandlersLive = Layer.mergeAll(
  sessionInitializeHandler,
  workerListHandler,
  workerGetHandler,
  workspaceListHandler,
)
