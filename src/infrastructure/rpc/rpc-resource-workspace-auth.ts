/** @Acp.Infra.Rpc.ResourceWorkspaceAuth — derive RPC workspace scope from resource ids */
import type { Headers } from '@effect/platform'
import { Effect, Option } from 'effect'
import { ArtifactService } from '../../domain/artifacts/index.js'
import { LeaseService } from '../../domain/leases/index.js'
import { ReviewService } from '../../domain/reviews/index.js'
import { WorkUnitService } from '../../domain/work-units/index.js'
import { NotFoundError } from '../../protocol/errors/protocol-error.js'
import type {
  ArtifactId,
  LeaseId,
  Permission,
  ReviewId,
  WorkId,
} from '../../protocol/schema/index.js'
import { rpcWorkspaceActor } from './rpc-auth.js'
import { toRpcError } from './rpc-error.js'

const fromOption =
  <A>(entity: string, id: string) =>
  (value: Option.Option<A>) =>
    Option.match(value, {
      onNone: () => Effect.fail(toRpcError(new NotFoundError({ entity, id }))),
      onSome: Effect.succeed,
    })

export const work = (
  headers: Headers.Headers,
  scope: Permission,
  workId: WorkId,
) =>
  Effect.gen(function* () {
    const service = yield* WorkUnitService
    const found = yield* Effect.flatMap(
      service.get(workId).pipe(Effect.mapError(toRpcError)),
      fromOption('work', workId),
    )
    const actor = yield* rpcWorkspaceActor(headers, scope, found.workspace_id)
    return { actor, work: found }
  })

export const lease = (
  headers: Headers.Headers,
  scope: Permission,
  leaseId: LeaseId,
) =>
  Effect.gen(function* () {
    const service = yield* LeaseService
    const found = yield* Effect.flatMap(
      service.get(leaseId).pipe(Effect.mapError(toRpcError)),
      fromOption('lease', leaseId),
    )
    const actor = yield* rpcWorkspaceActor(headers, scope, found.workspace_id)
    return { actor, lease: found }
  })

export const artifact = (
  headers: Headers.Headers,
  scope: Permission,
  artifactId: ArtifactId,
) =>
  Effect.gen(function* () {
    const service = yield* ArtifactService
    const found = yield* Effect.flatMap(
      service.get(artifactId).pipe(Effect.mapError(toRpcError)),
      fromOption('artifact', artifactId),
    )
    const actor = yield* rpcWorkspaceActor(headers, scope, found.workspace_id)
    return { actor, artifact: found }
  })

export const review = (
  headers: Headers.Headers,
  scope: Permission,
  reviewId: ReviewId,
) =>
  Effect.gen(function* () {
    const reviews = yield* ReviewService
    const workUnits = yield* WorkUnitService
    const found = yield* Effect.flatMap(
      reviews.get(reviewId).pipe(Effect.mapError(toRpcError)),
      fromOption('review', reviewId),
    )
    const parent = yield* Effect.flatMap(
      workUnits.get(found.work_id).pipe(Effect.mapError(toRpcError)),
      fromOption('work', found.work_id),
    )
    const actor = yield* rpcWorkspaceActor(headers, scope, parent.workspace_id)
    return { actor, review: found, work: parent }
  })
