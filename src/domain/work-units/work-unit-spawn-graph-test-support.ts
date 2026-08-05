/** @Acp.Domain.WorkUnits.SpawnGraph.TestSupport — harness for spawn graph tests */
import { Cause, Effect, Exit, Layer, Option, Schema } from 'effect'
import { TestAppConfigLive } from '../../config/app-config-test-support.js'
import type { EventStore } from '../events/index.js'
import { EventStoreLive, InProcessEventBrokerLive } from '../events/index.js'
import { InMemoryStorageLive } from '../../infrastructure/storage/index.js'
import type { StorageApi, Storage } from '../../infrastructure/storage/index.js'
import {
  CreateWorkPayload,
  Timestamp,
  WorkId,
  WorkerId,
  WorkspaceId,
} from '../../protocol/schema/index.js'
import type { WorkState } from '../../protocol/schema/index.js'
import { WorkUnitService, WorkUnitServiceLive } from './index.js'

export const workerId = Schema.decodeUnknownSync(WorkerId)('agent_alpha')
export const workspaceId =
  Schema.decodeUnknownSync(WorkspaceId)('workspace_graph')
export const otherWorkspaceId =
  Schema.decodeUnknownSync(WorkspaceId)('workspace_other')
export const now = Schema.decodeUnknownSync(Timestamp)('2026-08-04T10:00:00Z')

export const id = (raw: string): WorkId => Schema.decodeUnknownSync(WorkId)(raw)

const layerWithDepth = (maxWorkDepth: number) =>
  Layer.provideMerge(
    WorkUnitServiceLive,
    Layer.merge(
      Layer.provideMerge(
        EventStoreLive,
        Layer.merge(InMemoryStorageLive, InProcessEventBrokerLive),
      ),
      TestAppConfigLive({ maxWorkDepth }),
    ),
  )

export type TestEnv = WorkUnitService | EventStore | Storage

export const run = <A, E>(
  program: Effect.Effect<A, E, TestEnv>,
  maxWorkDepth = 10,
): A => Effect.runSync(Effect.provide(program, layerWithDepth(maxWorkDepth)))

export const runExit = <A, E>(
  program: Effect.Effect<A, E, TestEnv>,
  maxWorkDepth = 10,
): Exit.Exit<A, E> =>
  Effect.runSyncExit(Effect.provide(program, layerWithDepth(maxWorkDepth)))

const payload = (
  workspace: WorkspaceId = workspaceId,
  parent?: WorkId,
): CreateWorkPayload =>
  Schema.decodeUnknownSync(CreateWorkPayload)({
    workspace_id: workspace,
    title: 'Task',
    ...(parent === undefined ? {} : { parent_id: parent }),
  })

/** Creates a work unit, optionally under `parent`. */
export const create = (raw: string, parent?: WorkId, workspace = workspaceId) =>
  Effect.flatMap(WorkUnitService, (svc) =>
    svc.create({
      id: id(raw),
      payload: payload(workspace, parent),
      createdBy: workerId,
      now,
    }),
  )

/** Drives a unit from `open` to `running`, the state that accepts children. */
export const toRunning = (raw: string) =>
  Effect.flatMap(WorkUnitService, (svc) =>
    Effect.zipRight(
      svc.claim(id(raw), workerId, now),
      svc.transition(id(raw), 'running', workerId, now),
    ),
  )

export const transition = (raw: string, to: WorkState) =>
  Effect.flatMap(WorkUnitService, (svc) =>
    svc.transition(id(raw), to, workerId, now),
  )

/**
 * Writes a row straight into the `work` collection in its encoded shape,
 * bypassing the service. Used to reach states the public API guards against,
 * and to model rows written before the spawn graph existed.
 */
export const seedWork = (
  storage: StorageApi,
  row: {
    readonly id: string
    readonly state: WorkState
    readonly depth?: number
    readonly parent_id?: string
    readonly omitLineage?: boolean
  },
) =>
  storage.put('work', row.id, {
    id: row.id,
    workspace_id: workspaceId,
    title: 'Seeded',
    description: null,
    state: row.state,
    priority: 'normal',
    created_by: workerId,
    assigned_to: null,
    created_at: now,
    updated_at: now,
    ...(row.omitLineage === true
      ? {}
      : { parent_id: row.parent_id ?? null, depth: row.depth ?? 0 }),
  })

/** The `_tag` of the first typed failure, or 'Success'/'Defect' when there is none. */
export const failureTag = <A, E>(exit: Exit.Exit<A, E>): string => {
  if (Exit.isSuccess(exit)) return 'Success'
  return Option.match(Cause.failureOption(exit.cause), {
    onNone: () => 'Defect',
    onSome: (error) => (error as { _tag?: string })._tag ?? String(error),
  })
}

/** The first typed failure, for asserting on its payload. */
export const failureOf = <A, E>(exit: Exit.Exit<A, E>): E => {
  if (Exit.isSuccess(exit)) throw new Error('expected a failure')
  return Option.getOrThrowWith(
    Cause.failureOption(exit.cause),
    () => new Error('expected a typed failure, got a defect'),
  )
}
