/** @Acp.Infra.Rpc.CheckpointHandlers — native RPC checkpoint handlers */
import { Effect, Layer, Option } from 'effect'
import { CheckpointService } from '../../domain/checkpoints/index.js'
import { IdClock } from '../../app/server/identity.js'
import { NotFoundError } from '../../protocol/errors/protocol-error.js'
import type { CheckpointId } from '../../protocol/schema/index.js'
import { AcpRpcGroup } from './acp-rpc-contract.js'
import { rpcWorkspaceActor } from './rpc-auth.js'
import { toRpcError } from './rpc-error.js'
import * as resourceScope from './rpc-resource-workspace-auth.js'

const checkpointCreateHandler = AcpRpcGroup.toLayerHandler(
  'checkpoint.create',
  (payload, options) =>
    Effect.gen(function* () {
      const actor = yield* rpcWorkspaceActor(
        options.headers,
        'checkpoint:create',
        payload.workspace_id,
      )
      const checkpoints = yield* CheckpointService
      const idClock = yield* IdClock
      const id = (yield* idClock.nextId('checkpoint')) as CheckpointId
      const now = yield* idClock.now
      return yield* checkpoints
        .create({ id, payload, createdBy: actor, now })
        .pipe(Effect.mapError(toRpcError))
    }),
)

const checkpointListForWorkHandler = AcpRpcGroup.toLayerHandler(
  'checkpoint.list_for_work',
  (payload, options) =>
    Effect.gen(function* () {
      yield* resourceScope.work(
        options.headers,
        'workspace:read',
        payload.work_id,
      )
      const checkpoints = yield* CheckpointService
      return yield* checkpoints
        .listForWork(payload.work_id)
        .pipe(Effect.mapError(toRpcError))
    }),
)

const checkpointLatestForWorkHandler = AcpRpcGroup.toLayerHandler(
  'checkpoint.latest_for_work',
  (payload, options) =>
    Effect.gen(function* () {
      yield* resourceScope.work(
        options.headers,
        'workspace:read',
        payload.work_id,
      )
      const checkpoints = yield* CheckpointService
      const latest = yield* checkpoints
        .latestForWork(payload.work_id)
        .pipe(Effect.mapError(toRpcError))
      return yield* Option.match(latest, {
        onNone: () =>
          Effect.fail(
            toRpcError(
              new NotFoundError({
                entity: 'checkpoint',
                id: `latest:${payload.work_id}`,
              }),
            ),
          ),
        onSome: Effect.succeed,
      })
    }),
)

const checkpointListForWorkspaceHandler = AcpRpcGroup.toLayerHandler(
  'checkpoint.list_for_workspace',
  (payload, options) =>
    Effect.gen(function* () {
      yield* rpcWorkspaceActor(
        options.headers,
        'workspace:read',
        payload.workspace_id,
      )
      const checkpoints = yield* CheckpointService
      return yield* checkpoints
        .listForWorkspace(payload.workspace_id)
        .pipe(Effect.mapError(toRpcError))
    }),
)

export const AcpRpcCheckpointHandlersLive = Layer.mergeAll(
  checkpointCreateHandler,
  checkpointListForWorkHandler,
  checkpointLatestForWorkHandler,
  checkpointListForWorkspaceHandler,
)
