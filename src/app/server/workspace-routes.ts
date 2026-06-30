/** @Acp.App.Server.WorkspaceRoutes — workspace HTTP route handlers */
import { HttpServerRequest } from '@effect/platform'
import { Effect, Schema } from 'effect'
import { ArtifactService } from '../../domain/artifacts/index.js'
import { CheckpointService } from '../../domain/checkpoints/index.js'
import { ReviewService } from '../../domain/reviews/index.js'
import { WorkUnitService } from '../../domain/work-units/index.js'
import { WorkspaceService } from '../../domain/workspaces/index.js'
import {
  Artifact,
  Checkpoint,
  CreateWorkspacePayload,
  Review,
  UpdateWorkspacePayload,
  WorkUnit,
  Workspace,
} from '../../protocol/schema/index.js'
import type { WorkspaceId } from '../../protocol/schema/index.js'
import { IdClock } from './identity.js'
import { authorize, ok, pathParam, respond } from './route-support.js'

export const listWorkspaces = respond('GET /v1/workspaces')(
  Effect.gen(function* () {
    const workspaces = yield* WorkspaceService
    yield* authorize('workspace:read')
    const all = yield* workspaces.list()
    return yield* ok(200)(Schema.Array(Workspace), all)
  }),
)

export const listWorkspaceWork = respond(
  'GET /v1/workspaces/:workspace_id/work',
)(
  Effect.gen(function* () {
    const work = yield* WorkUnitService
    const workspaceId = (yield* pathParam('workspace_id')) as WorkspaceId
    yield* authorize('workspace:read')
    const all = yield* work.listForWorkspace(workspaceId)
    return yield* ok(200)(Schema.Array(WorkUnit), all)
  }),
)

export const listWorkspaceCheckpoints = respond(
  'GET /v1/workspaces/:workspace_id/checkpoints',
)(
  Effect.gen(function* () {
    const checkpoints = yield* CheckpointService
    const workspaceId = (yield* pathParam('workspace_id')) as WorkspaceId
    yield* authorize('workspace:read')
    const all = yield* checkpoints.listForWorkspace(workspaceId)
    return yield* ok(200)(Schema.Array(Checkpoint), all)
  }),
)

export const listWorkspaceArtifacts = respond(
  'GET /v1/workspaces/:workspace_id/artifacts',
)(
  Effect.gen(function* () {
    const artifacts = yield* ArtifactService
    const workspaceId = (yield* pathParam('workspace_id')) as WorkspaceId
    yield* authorize('workspace:read')
    const all = yield* artifacts.listForWorkspace(workspaceId)
    return yield* ok(200)(Schema.Array(Artifact), all)
  }),
)

export const listWorkspaceReviews = respond(
  'GET /v1/workspaces/:workspace_id/reviews',
)(
  Effect.gen(function* () {
    const reviews = yield* ReviewService
    const workspaceId = (yield* pathParam('workspace_id')) as WorkspaceId
    yield* authorize('workspace:read')
    const all = yield* reviews.listForWorkspace(workspaceId)
    return yield* ok(200)(Schema.Array(Review), all)
  }),
)

export const createWorkspace = respond('POST /v1/workspaces')(
  Effect.gen(function* () {
    const workspaces = yield* WorkspaceService
    const idClock = yield* IdClock
    const payload = yield* HttpServerRequest.schemaBodyJson(
      CreateWorkspacePayload,
    )
    const id = (yield* idClock.nextId('workspace')) as WorkspaceId
    const now = yield* idClock.now
    const actor = yield* authorize('workspace:write')
    const workspace = yield* workspaces.create(
      { id, state: 'active', ...payload },
      actor,
      now,
    )
    return yield* ok(201)(Workspace, workspace)
  }),
)

export const updateWorkspace = respond('PATCH /v1/workspaces/:workspace_id')(
  Effect.gen(function* () {
    const workspaces = yield* WorkspaceService
    const idClock = yield* IdClock
    const workspaceId = (yield* pathParam('workspace_id')) as WorkspaceId
    const payload = yield* HttpServerRequest.schemaBodyJson(
      UpdateWorkspacePayload,
    )
    const now = yield* idClock.now
    const actor = yield* authorize('workspace:write')
    const workspace = yield* workspaces.update(
      { id: workspaceId, state: 'active', ...payload },
      actor,
      now,
    )
    return yield* ok(200)(Workspace, workspace)
  }),
)

export const archiveWorkspace = respond(
  'POST /v1/workspaces/:workspace_id/archive',
)(
  Effect.gen(function* () {
    const workspaces = yield* WorkspaceService
    const idClock = yield* IdClock
    const workspaceId = (yield* pathParam('workspace_id')) as WorkspaceId
    const now = yield* idClock.now
    const actor = yield* authorize('workspace:write')
    const workspace = yield* workspaces.archive(workspaceId, actor, now)
    return yield* ok(200)(Workspace, workspace)
  }),
)
