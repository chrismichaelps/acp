/** @Acp.Infra.Rpc.ReviewHandlers — native RPC review handlers */
import { Effect, Layer, Option } from 'effect'
import { ReviewService } from '../../domain/reviews/index.js'
import { IdClock } from '../../app/server/identity.js'
import type { ReviewId } from '../../protocol/schema/index.js'
import { AcpRpcGroup } from './acp-rpc-contract.js'
import { rpcWorkspaceActor } from './rpc-auth.js'
import { toRpcError } from './rpc-error.js'
import * as resourceScope from './rpc-resource-workspace-auth.js'

const reviewRequestHandler = AcpRpcGroup.toLayerHandler(
  'review.request',
  (payload, options) =>
    Effect.gen(function* () {
      yield* resourceScope.work(
        options.headers,
        'review:create',
        payload.work_id,
      )
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
      const { actor } = yield* resourceScope.review(
        options.headers,
        'review:approve',
        payload.review_id,
      )
      const reviews = yield* ReviewService
      const idClock = yield* IdClock
      const now = yield* idClock.now
      return yield* reviews
        .approve(
          payload.review_id,
          actor,
          now,
          payload.met_requirements,
          Option.fromNullable(payload.approval_signature),
        )
        .pipe(Effect.mapError(toRpcError))
    }),
)

const reviewRejectHandler = AcpRpcGroup.toLayerHandler(
  'review.reject',
  (payload, options) =>
    Effect.gen(function* () {
      const { actor } = yield* resourceScope.review(
        options.headers,
        'review:reject',
        payload.review_id,
      )
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
      const { actor } = yield* resourceScope.review(
        options.headers,
        'review:request_changes',
        payload.review_id,
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
      const { actor } = yield* resourceScope.review(
        options.headers,
        'review:cancel',
        payload.review_id,
      )
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
      yield* resourceScope.work(
        options.headers,
        'workspace:read',
        payload.work_id,
      )
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
      yield* rpcWorkspaceActor(
        options.headers,
        'workspace:read',
        payload.workspace_id,
      )
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
