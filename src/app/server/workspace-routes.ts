/** @Acp.App.Server.WorkspaceRoutes — workspace HTTP route handlers */
import { HttpServerRequest } from '@effect/platform'
import { Effect, Schema } from 'effect'
import { WorkspaceService } from '../../domain/workspaces/index.js'
import {
  CreateWorkspacePayload,
  UpdateWorkspacePayload,
  Workspace,
} from '../../protocol/schema/index.js'
import type { WorkspaceId } from '../../protocol/schema/index.js'
import { IdClock } from './identity.js'
import { authorize, ok, pathParam, respond } from './route-support.js'

export const listWorkspaces = respond(
  Effect.gen(function* () {
    const workspaces = yield* WorkspaceService
    yield* authorize('workspace:read')
    const all = yield* workspaces.list()
    return yield* ok(200)(Schema.Array(Workspace), all)
  }),
)

export const createWorkspace = respond(
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

export const updateWorkspace = respond(
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
