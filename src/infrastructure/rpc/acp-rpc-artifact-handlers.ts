/** @Acp.Infra.Rpc.ArtifactHandlers — native RPC artifact handlers */
import { Effect, Layer, Option } from 'effect'
import { ArtifactService } from '../../domain/artifacts/index.js'
import type { ArtifactServiceApi } from '../../domain/artifacts/index.js'
import { WorkUnitService } from '../../domain/work-units/index.js'
import { IdClock } from '../../app/server/identity.js'
import { NotFoundError } from '../../protocol/errors/protocol-error.js'
import type { ArtifactId } from '../../protocol/schema/index.js'
import { AcpRpcGroup } from './acp-rpc-contract.js'
import { authorizeRpc } from './rpc-auth.js'
import { toRpcError } from './rpc-error.js'

const requireArtifact = (
  artifacts: ArtifactServiceApi,
  artifactId: ArtifactId,
) =>
  Effect.flatMap(
    artifacts.get(artifactId).pipe(Effect.mapError(toRpcError)),
    (artifact) =>
      Option.match(artifact, {
        onNone: () =>
          Effect.fail(
            toRpcError(
              new NotFoundError({ entity: 'artifact', id: artifactId }),
            ),
          ),
        onSome: Effect.succeed,
      }),
  )

const artifactCreateHandler = AcpRpcGroup.toLayerHandler(
  'artifact.create',
  (payload, options) =>
    Effect.gen(function* () {
      const actor = yield* authorizeRpc(options.headers, 'artifact:create')
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
      const actor = yield* authorizeRpc(options.headers, 'artifact:update')
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
      const actor = yield* authorizeRpc(options.headers, 'artifact:delete')
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
      yield* authorizeRpc(options.headers, 'workspace:read')
      const artifacts = yield* ArtifactService
      yield* requireArtifact(artifacts, payload.artifact_id)
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
      yield* authorizeRpc(options.headers, 'workspace:read')
      const workUnits = yield* WorkUnitService
      const work = yield* workUnits
        .get(payload.work_id)
        .pipe(Effect.mapError(toRpcError))
      yield* Option.match(work, {
        onNone: () =>
          Effect.fail(
            toRpcError(
              new NotFoundError({ entity: 'work', id: payload.work_id }),
            ),
          ),
        onSome: Effect.succeed,
      })
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
      yield* authorizeRpc(options.headers, 'workspace:read')
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
