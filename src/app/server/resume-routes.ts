/** @Acp.App.Server.ResumeRoutes — work-scoped handoff read handlers */
import { Effect, Option, Schema } from 'effect'
import { ArtifactService } from '../../domain/artifacts/index.js'
import { CheckpointService } from '../../domain/checkpoints/index.js'
import { ReviewService } from '../../domain/reviews/index.js'
import { WorkUnitService } from '../../domain/work-units/index.js'
import { ArtifactContentResponse } from '../../infrastructure/http/index.js'
import { NotFoundError } from '../../protocol/errors/protocol-error.js'
import {
  Artifact,
  Checkpoint,
  Review,
  WorkUnit,
  WorkResumePacket,
} from '../../protocol/schema/index.js'
import type { ArtifactId, WorkId } from '../../protocol/schema/index.js'
import type { WorkUnitServiceApi } from '../../domain/work-units/index.js'
import { authorizeWorkspace, ok, pathParam, respond } from './route-support.js'

const workIdParam = () =>
  Effect.map(pathParam('work_id'), (workId) => workId as WorkId)

const artifactIdParam = () =>
  Effect.map(pathParam('artifact_id'), (artifactId) => artifactId as ArtifactId)

const requireWork = (work: WorkUnitServiceApi, workId: WorkId) =>
  Effect.flatMap(work.get(workId), (stored) =>
    Option.match(stored, {
      onNone: () =>
        Effect.fail(new NotFoundError({ entity: 'work', id: workId })),
      onSome: Effect.succeed,
    }),
  )

export const getWork = respond('GET /v1/work/:work_id')(
  Effect.gen(function* () {
    const work = yield* WorkUnitService
    const workId = yield* workIdParam()
    const found = yield* requireWork(work, workId)
    yield* authorizeWorkspace('workspace:read', found.workspace_id)
    return yield* ok(200)(WorkUnit, found)
  }),
)

export const getWorkResumePacket = respond('GET /v1/work/:work_id/resume')(
  Effect.gen(function* () {
    const work = yield* WorkUnitService
    const checkpoints = yield* CheckpointService
    const artifacts = yield* ArtifactService
    const reviews = yield* ReviewService
    const workId = yield* workIdParam()
    const foundWork = yield* requireWork(work, workId)
    yield* authorizeWorkspace('workspace:read', foundWork.workspace_id)
    const latest = yield* checkpoints.latestForWork(workId)
    const foundArtifacts = yield* artifacts.listForWork(workId)
    const foundReviews = yield* reviews.listForWork(workId)
    return yield* ok(200)(WorkResumePacket, {
      work: foundWork,
      latest_checkpoint: latest,
      artifacts: foundArtifacts,
      reviews: foundReviews,
    })
  }),
)

export const listWorkCheckpoints = respond('GET /v1/work/:work_id/checkpoints')(
  Effect.gen(function* () {
    const work = yield* WorkUnitService
    const checkpoints = yield* CheckpointService
    const workId = yield* workIdParam()
    const foundWork = yield* requireWork(work, workId)
    yield* authorizeWorkspace('workspace:read', foundWork.workspace_id)
    const found = yield* checkpoints.listForWork(workId)
    return yield* ok(200)(Schema.Array(Checkpoint), found)
  }),
)

export const latestWorkCheckpoint = respond(
  'GET /v1/work/:work_id/checkpoints/latest',
)(
  Effect.gen(function* () {
    const work = yield* WorkUnitService
    const checkpoints = yield* CheckpointService
    const workId = yield* workIdParam()
    const foundWork = yield* requireWork(work, workId)
    yield* authorizeWorkspace('workspace:read', foundWork.workspace_id)
    const latest = yield* checkpoints.latestForWork(workId)
    return yield* Option.match(latest, {
      onNone: () =>
        Effect.fail(
          new NotFoundError({ entity: 'checkpoint', id: `latest:${workId}` }),
        ),
      onSome: (checkpoint) => ok(200)(Checkpoint, checkpoint),
    })
  }),
)

export const listWorkArtifacts = respond('GET /v1/work/:work_id/artifacts')(
  Effect.gen(function* () {
    const work = yield* WorkUnitService
    const artifacts = yield* ArtifactService
    const workId = yield* workIdParam()
    const foundWork = yield* requireWork(work, workId)
    yield* authorizeWorkspace('workspace:read', foundWork.workspace_id)
    const found = yield* artifacts.listForWork(workId)
    return yield* ok(200)(Schema.Array(Artifact), found)
  }),
)

export const listWorkReviews = respond('GET /v1/work/:work_id/reviews')(
  Effect.gen(function* () {
    const work = yield* WorkUnitService
    const reviews = yield* ReviewService
    const workId = yield* workIdParam()
    const foundWork = yield* requireWork(work, workId)
    yield* authorizeWorkspace('workspace:read', foundWork.workspace_id)
    const found = yield* reviews.listForWork(workId)
    return yield* ok(200)(Schema.Array(Review), found)
  }),
)

export const getArtifactContent = respond(
  'GET /v1/artifacts/:artifact_id/content',
)(
  Effect.gen(function* () {
    const artifacts = yield* ArtifactService
    const artifactId = yield* artifactIdParam()
    const artifact = yield* artifacts.get(artifactId)
    const found = yield* Option.match(artifact, {
      onNone: () =>
        Effect.fail(new NotFoundError({ entity: 'artifact', id: artifactId })),
      onSome: Effect.succeed,
    })
    yield* authorizeWorkspace('workspace:read', found.workspace_id)
    const content = yield* artifacts.readContent(artifactId)
    return yield* Option.match(content, {
      onNone: () =>
        Effect.fail(
          new NotFoundError({
            entity: 'artifact_content',
            id: artifactId,
          }),
        ),
      onSome: (value) => ok(200)(ArtifactContentResponse, { content: value }),
    })
  }),
)
