/** @Acp.Domain.Workspaces.Service — Workspace registry + event emission */
import { Chunk, Context, Effect, Layer, Option, Schema } from 'effect'
import { EventStore } from '../events/index.js'
import { Storage } from '../../infrastructure/storage/index.js'
import {
  NotFoundError,
  StorageError,
} from '../../protocol/errors/protocol-error.js'
import { Event, Workspace } from '../../protocol/schema/index.js'
import type {
  EventType,
  Timestamp,
  WorkerId,
  WorkspaceId,
} from '../../protocol/schema/index.js'

export interface WorkspaceServiceApi {
  readonly create: (
    workspace: Workspace,
    actor: WorkerId,
    now: Timestamp,
  ) => Effect.Effect<Workspace, StorageError>
  readonly get: (
    id: WorkspaceId,
  ) => Effect.Effect<Option.Option<Workspace>, StorageError>
  readonly list: () => Effect.Effect<readonly Workspace[], StorageError>
  readonly update: (
    workspace: Workspace,
    actor: WorkerId,
    now: Timestamp,
  ) => Effect.Effect<Workspace, NotFoundError | StorageError>
}

export class WorkspaceService extends Context.Tag('WorkspaceService')<
  WorkspaceService,
  WorkspaceServiceApi
>() {}

const collection = 'workspace'

const decodeStoredWorkspace = (value: unknown) =>
  Schema.decodeUnknown(Workspace)(value).pipe(
    Effect.mapError(
      (error) =>
        new StorageError({
          op: 'decode_workspace',
          cause: String(error),
        }),
    ),
  )

const make = Effect.gen(function* () {
  const storage = yield* Storage
  const events = yield* EventStore

  const encodeWorkspace = (workspace: Workspace) =>
    Schema.encode(Workspace)(workspace).pipe(
      Effect.mapError(
        (error) =>
          new StorageError({
            op: 'encode_workspace',
            cause: String(error),
          }),
      ),
    )

  const save = (workspace: Workspace) =>
    Effect.flatMap(encodeWorkspace(workspace), (encoded) =>
      storage.put(collection, workspace.id, encoded),
    )

  const appendWorkspaceEvent = (
    workspace: Workspace,
    actor: WorkerId,
    timestamp: Timestamp,
    type: EventType,
  ) =>
    Effect.flatMap(
      Schema.decodeUnknown(Event)({
        id: `event_${workspace.id}_${type}_${timestamp}`,
        type,
        workspace_id: workspace.id,
        work_id: null,
        actor,
        timestamp,
        seq: 0,
        data: { workspace_id: workspace.id, kind: workspace.kind },
      }).pipe(
        Effect.mapError(
          (error) =>
            new StorageError({
              op: 'decode_workspace_event',
              cause: String(error),
            }),
        ),
      ),
      (event) =>
        events.append({
          id: event.id,
          type: event.type,
          workspace_id: event.workspace_id,
          work_id: event.work_id,
          actor: event.actor,
          timestamp: event.timestamp,
          data: event.data,
        }),
    )

  const get: WorkspaceServiceApi['get'] = (id) =>
    Effect.flatMap(storage.get(collection, id), (stored) =>
      Option.match(stored, {
        onNone: () => Effect.succeed(Option.none<Workspace>()),
        onSome: (value) =>
          Effect.map(decodeStoredWorkspace(value), Option.some),
      }),
    )

  const list: WorkspaceServiceApi['list'] = () =>
    Effect.flatMap(storage.list(collection), (stored) =>
      Effect.forEach(Chunk.toReadonlyArray(stored), decodeStoredWorkspace),
    )

  const create: WorkspaceServiceApi['create'] = (workspace, actor, now) =>
    Effect.gen(function* () {
      yield* save(workspace)
      yield* appendWorkspaceEvent(workspace, actor, now, 'workspace.created')
      return workspace
    })

  const requireWorkspace = (id: WorkspaceId) =>
    Effect.flatMap(get(id), (workspace) =>
      Option.match(workspace, {
        onNone: () =>
          Effect.fail(new NotFoundError({ entity: 'workspace', id })),
        onSome: Effect.succeed,
      }),
    )

  const update: WorkspaceServiceApi['update'] = (workspace, actor, now) =>
    Effect.flatMap(requireWorkspace(workspace.id), () =>
      Effect.gen(function* () {
        yield* save(workspace)
        yield* appendWorkspaceEvent(workspace, actor, now, 'workspace.updated')
        return workspace
      }),
    )

  return {
    create,
    get,
    list,
    update,
  } satisfies WorkspaceServiceApi
})

export const WorkspaceServiceLive: Layer.Layer<
  WorkspaceService,
  never,
  Storage | EventStore
> = Layer.effect(WorkspaceService, make)
