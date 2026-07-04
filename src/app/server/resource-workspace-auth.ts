/** @Acp.App.Server.ResourceWorkspaceAuth — derive tenant scope from resource ids */
import { Effect, Option } from 'effect'
import { ArtifactService } from '../../domain/artifacts/index.js'
import { LeaseService } from '../../domain/leases/index.js'
import { ReviewService } from '../../domain/reviews/index.js'
import { WorkUnitService } from '../../domain/work-units/index.js'
import { NotFoundError } from '../../protocol/errors/protocol-error.js'
import type {
  Artifact,
  ArtifactId,
  Lease,
  LeaseId,
  Permission,
  Review,
  ReviewId,
  WorkId,
  WorkUnit,
  WorkerId,
} from '../../protocol/schema/index.js'
import { authorizeWorkspace } from './route-support.js'

const fromOption =
  <A>(entity: string, id: string) =>
  (value: Option.Option<A>) =>
    Option.match(value, {
      onNone: () => Effect.fail(new NotFoundError({ entity, id })),
      onSome: Effect.succeed,
    })

export const work = (scope: Permission, workId: WorkId) =>
  Effect.gen(function* () {
    const service = yield* WorkUnitService
    const work = yield* Effect.flatMap(
      service.get(workId),
      fromOption('work', workId),
    )
    const actor = yield* authorizeWorkspace(scope, work.workspace_id)
    return { actor, work } satisfies {
      readonly actor: WorkerId
      readonly work: WorkUnit
    }
  })

export const lease = (scope: Permission, leaseId: LeaseId) =>
  Effect.gen(function* () {
    const service = yield* LeaseService
    const lease = yield* Effect.flatMap(
      service.get(leaseId),
      fromOption('lease', leaseId),
    )
    const actor = yield* authorizeWorkspace(scope, lease.workspace_id)
    return { actor, lease } satisfies {
      readonly actor: WorkerId
      readonly lease: Lease
    }
  })

export const artifact = (scope: Permission, artifactId: ArtifactId) =>
  Effect.gen(function* () {
    const service = yield* ArtifactService
    const artifact = yield* Effect.flatMap(
      service.get(artifactId),
      fromOption('artifact', artifactId),
    )
    const actor = yield* authorizeWorkspace(scope, artifact.workspace_id)
    return { actor, artifact } satisfies {
      readonly actor: WorkerId
      readonly artifact: Artifact
    }
  })

export const review = (scope: Permission, reviewId: ReviewId) =>
  Effect.gen(function* () {
    const reviews = yield* ReviewService
    const workUnits = yield* WorkUnitService
    const review = yield* Effect.flatMap(
      reviews.get(reviewId),
      fromOption('review', reviewId),
    )
    const work = yield* Effect.flatMap(
      workUnits.get(review.work_id),
      fromOption('work', review.work_id),
    )
    const actor = yield* authorizeWorkspace(scope, work.workspace_id)
    return { actor, review, work } satisfies {
      readonly actor: WorkerId
      readonly review: Review
      readonly work: WorkUnit
    }
  })

export const reviewRequest = (scope: Permission, workId: WorkId) =>
  work(scope, workId)
