/** @Acp.Infra.Rpc.ReviewHandlers — native RPC review handlers */
import { Effect, Layer, Option } from 'effect'
import { ReviewService } from '../../domain/reviews/index.js'
import { WorkUnitService } from '../../domain/work-units/index.js'
import type { WorkUnitServiceApi } from '../../domain/work-units/index.js'
import { IdClock } from '../../app/server/identity.js'
import { NotFoundError } from '../../protocol/errors/protocol-error.js'
import type { ReviewId, WorkId } from '../../protocol/schema/index.js'
import { AcpRpcGroup } from './acp-rpc-contract.js'
import { authorizeRpc } from './rpc-auth.js'
import { toRpcError } from './rpc-error.js'

const requireWork = (workUnits: WorkUnitServiceApi, workId: WorkId) =>
  Effect.flatMap(
    workUnits.get(workId).pipe(Effect.mapError(toRpcError)),
    (work) =>
      Option.match(work, {
        onNone: () =>
          Effect.fail(
            toRpcError(new NotFoundError({ entity: 'work', id: workId })),
          ),
        onSome: Effect.succeed,
      }),
  )

const reviewRequestHandler = AcpRpcGroup.toLayerHandler(
  'review.request',
  (payload, options) =>
    Effect.gen(function* () {
      yield* authorizeRpc(options.headers, 'review:create')
      const reviews = yield* ReviewService
      const idClock = yield* IdClock
      const id = (yield* idClock.nextId('review')) as ReviewId
      const now = yield* idClock.now
      return yield* reviews
        .request({ id, payload, now })
        .pipe(Effect.mapError(toRpcError))
    }),
)

const reviewApproveHandler = AcpRpcGroup.toLayerHandler(
  'review.approve',
  (payload, options) =>
    Effect.gen(function* () {
      const actor = yield* authorizeRpc(options.headers, 'review:approve')
      const reviews = yield* ReviewService
      const idClock = yield* IdClock
      const now = yield* idClock.now
      return yield* reviews
        .approve(payload.review_id, actor, now, payload.met_requirements)
        .pipe(Effect.mapError(toRpcError))
    }),
)

const reviewRejectHandler = AcpRpcGroup.toLayerHandler(
  'review.reject',
  (payload, options) =>
    Effect.gen(function* () {
      const actor = yield* authorizeRpc(options.headers, 'review:reject')
      const reviews = yield* ReviewService
      const idClock = yield* IdClock
      const now = yield* idClock.now
      return yield* reviews
        .reject(payload.review_id, actor, now)
        .pipe(Effect.mapError(toRpcError))
    }),
)

const reviewRequestChangesHandler = AcpRpcGroup.toLayerHandler(
  'review.request_changes',
  (payload, options) =>
    Effect.gen(function* () {
      const actor = yield* authorizeRpc(
        options.headers,
        'review:request_changes',
      )
      const reviews = yield* ReviewService
      const idClock = yield* IdClock
      const now = yield* idClock.now
      return yield* reviews
        .requestChanges(payload.review_id, actor, now)
        .pipe(Effect.mapError(toRpcError))
    }),
)

const reviewCancelHandler = AcpRpcGroup.toLayerHandler(
  'review.cancel',
  (payload, options) =>
    Effect.gen(function* () {
      const actor = yield* authorizeRpc(options.headers, 'review:cancel')
      const reviews = yield* ReviewService
      const idClock = yield* IdClock
      const now = yield* idClock.now
      return yield* reviews
        .cancel(payload.review_id, actor, now)
        .pipe(Effect.mapError(toRpcError))
    }),
)

const reviewListForWorkHandler = AcpRpcGroup.toLayerHandler(
  'review.list_for_work',
  (payload, options) =>
    Effect.gen(function* () {
      yield* authorizeRpc(options.headers, 'workspace:read')
      const workUnits = yield* WorkUnitService
      yield* requireWork(workUnits, payload.work_id)
      const reviews = yield* ReviewService
      return yield* reviews
        .listForWork(payload.work_id)
        .pipe(Effect.mapError(toRpcError))
    }),
)

const reviewListForWorkspaceHandler = AcpRpcGroup.toLayerHandler(
  'review.list_for_workspace',
  (payload, options) =>
    Effect.gen(function* () {
      yield* authorizeRpc(options.headers, 'workspace:read')
      const reviews = yield* ReviewService
      return yield* reviews
        .listForWorkspace(payload.workspace_id)
        .pipe(Effect.mapError(toRpcError))
    }),
)

export const AcpRpcReviewHandlersLive = Layer.mergeAll(
  reviewRequestHandler,
  reviewApproveHandler,
  reviewRejectHandler,
  reviewRequestChangesHandler,
  reviewCancelHandler,
  reviewListForWorkHandler,
  reviewListForWorkspaceHandler,
)
