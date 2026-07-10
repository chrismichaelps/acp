/** @Acp.App.Server.ResumeRoutes — work-scoped handoff read handlers */
import {
  Headers,
  HttpServerRequest,
  HttpServerResponse,
} from '@effect/platform'
import { Effect, Option, Schema } from 'effect'
import { ArtifactService } from '../../domain/artifacts/index.js'
import { CheckpointService } from '../../domain/checkpoints/index.js'
import { GrillService } from '../../domain/grills/index.js'
import { ReviewCommentService } from '../../domain/review-comments/index.js'
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
import {
  budgetResume,
  etagOf,
  parseBudget,
  resumeDigest,
} from './resume-workspace.js'

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
    const reviewComments = yield* ReviewCommentService
    const grills = yield* GrillService
    const workId = yield* workIdParam()
    const foundWork = yield* requireWork(work, workId)
    yield* authorizeWorkspace('workspace:read', foundWork.workspace_id)
    const latest = yield* checkpoints.latestForWork(workId)
    const foundArtifacts = yield* artifacts.listForWork(workId)
    const foundReviews = yield* reviews.listForWork(workId)
    const comments = yield* reviewComments.listForWork(workId)
    const openComments = comments.filter((comment) => comment.state === 'open')
    const grillLists = yield* Effect.forEach(foundReviews, (review) =>
      grills.listForReview(review.id),
    )
    const latestGrill = grillLists.flat().reduce(
      (newest, grill) =>
        Option.match(newest, {
          onNone: () => Option.some(grill),
          onSome: (current) =>
            Date.parse(grill.created_at) >= Date.parse(current.created_at)
              ? Option.some(grill)
              : newest,
        }),
      Option.none<(typeof grillLists)[number][number]>(),
    )

    // The full, unbudgeted packet is the canonical state the ETag is computed
    // over; the response body may be a bounded, salience-ranked view of it.
    const fullPacket = {
      work: foundWork,
      latest_checkpoint: latest,
      artifacts: foundArtifacts,
      reviews: foundReviews,
      open_comments: openComments,
      latest_grill: latestGrill,
    }
    const request = yield* HttpServerRequest.HttpServerRequest
    const query = new URL(request.url, 'http://acp.local').searchParams
    const budget = parseBudget(query.get('budget') ?? undefined)

    const encodedFull = yield* Schema.encode(WorkResumePacket)(fullPacket)
    const etag = etagOf(resumeDigest(JSON.stringify(encodedFull), budget))

    // Write-once-read-many: a caller that already holds this packet revalidates
    // with If-None-Match and gets 304 instead of re-downloading the whole thing.
    const ifNoneMatch = Option.getOrElse(
      Headers.get(request.headers, 'if-none-match'),
      () => '',
    )
    if (ifNoneMatch === etag) {
      return HttpServerResponse.empty({ status: 304 }).pipe(
        HttpServerResponse.setHeader('etag', etag),
      )
    }

    const latestGrillReviewId = Option.match(latestGrill, {
      onNone: () => null,
      onSome: (grill) => grill.review_id,
    })
    const budgeted = budgetResume(
      foundArtifacts,
      foundReviews,
      latestGrillReviewId,
      budget,
    )
    const encodedBody =
      budget === null
        ? encodedFull
        : yield* Schema.encode(WorkResumePacket)({
            ...fullPacket,
            artifacts: budgeted.artifacts,
            reviews: budgeted.reviews,
            ...(budgeted.elided === undefined
              ? {}
              : { elided: budgeted.elided }),
          })
    return HttpServerResponse.unsafeJson(encodedBody, { status: 200 }).pipe(
      HttpServerResponse.setHeader('etag', etag),
    )
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
