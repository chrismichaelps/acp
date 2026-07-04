/** @Acp.Infra.Rpc.ArtifactHandlers — native RPC artifact handlers */
import { Effect, Layer, Option } from 'effect'
import { ArtifactService } from '../../domain/artifacts/index.js'
import { IdClock } from '../../app/server/identity.js'
import { NotFoundError } from '../../protocol/errors/protocol-error.js'
import type { ArtifactId } from '../../protocol/schema/index.js'
import { AcpRpcGroup } from './acp-rpc-contract.js'
import { rpcWorkspaceActor } from './rpc-auth.js'
import { toRpcError } from './rpc-error.js'
import * as resourceScope from './rpc-resource-workspace-auth.js'

const artifactCreateHandler = AcpRpcGroup.toLayerHandler(
  'artifact.create',
  (payload, options) =>
    Effect.gen(function* () {
      const actor = yield* rpcWorkspaceActor(
        options.headers,
        'artifact:create',
        payload.workspace_id,
      )
      const artifacts = yield* ArtifactService
      const idClock = yield* IdClock
      const id = (yield* idClock.nextId('artifact')) as ArtifactId
      const now = yield* idClock.now
      return yield* artifacts
        .create({ id, payload, createdBy: actor, now })
        .pipe(Effect.mapError(toRpcError))
    }),
)

const artifactUpdateHandler = AcpRpcGroup.toLayerHandler(
  'artifact.update',
  (payload, options) =>
    Effect.gen(function* () {
      const { actor } = yield* resourceScope.artifact(
        options.headers,
        'artifact:update',
        payload.artifact_id,
      )
      const artifacts = yield* ArtifactService
      const idClock = yield* IdClock
      const now = yield* idClock.now
      return yield* artifacts
        .update(payload.artifact_id, payload, actor, now)
        .pipe(Effect.mapError(toRpcError))
    }),
)

const artifactDeleteHandler = AcpRpcGroup.toLayerHandler(
  'artifact.delete',
  (payload, options) =>
    Effect.gen(function* () {
      const { actor } = yield* resourceScope.artifact(
        options.headers,
        'artifact:delete',
        payload.artifact_id,
      )
      const artifacts = yield* ArtifactService
      const idClock = yield* IdClock
      const now = yield* idClock.now
      return yield* artifacts
        .remove(payload.artifact_id, actor, now)
        .pipe(Effect.mapError(toRpcError))
    }),
)

const artifactContentHandler = AcpRpcGroup.toLayerHandler(
  'artifact.content',
  (payload, options) =>
    Effect.gen(function* () {
      yield* resourceScope.artifact(
        options.headers,
        'workspace:read',
        payload.artifact_id,
      )
      const artifacts = yield* ArtifactService
      const content = yield* artifacts
        .readContent(payload.artifact_id)
        .pipe(Effect.mapError(toRpcError))
      return yield* Option.match(content, {
        onNone: () =>
          Effect.fail(
            toRpcError(
              new NotFoundError({
                entity: 'artifact_content',
                id: payload.artifact_id,
              }),
            ),
          ),
        onSome: (value) => Effect.succeed({ content: value }),
      })
    }),
)

const artifactListForWorkHandler = AcpRpcGroup.toLayerHandler(
  'artifact.list_for_work',
  (payload, options) =>
    Effect.gen(function* () {
      yield* resourceScope.work(
        options.headers,
        'workspace:read',
        payload.work_id,
      )
      const artifacts = yield* ArtifactService
      return yield* artifacts
        .listForWork(payload.work_id)
        .pipe(Effect.mapError(toRpcError))
    }),
)

const artifactListForWorkspaceHandler = AcpRpcGroup.toLayerHandler(
  'artifact.list_for_workspace',
  (payload, options) =>
    Effect.gen(function* () {
      yield* rpcWorkspaceActor(
        options.headers,
        'workspace:read',
        payload.workspace_id,
      )
      const artifacts = yield* ArtifactService
      return yield* artifacts
        .listForWorkspace(payload.workspace_id)
        .pipe(Effect.mapError(toRpcError))
    }),
)

export const AcpRpcArtifactHandlersLive = Layer.mergeAll(
  artifactCreateHandler,
  artifactUpdateHandler,
  artifactDeleteHandler,
  artifactContentHandler,
  artifactListForWorkHandler,
  artifactListForWorkspaceHandler,
)
