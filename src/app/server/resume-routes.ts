/** @Acp.App.Server.ResumeRoutes — work-scoped handoff read handlers */
import { Effect, Option, Schema } from 'effect'
import { ArtifactService } from '../../domain/artifacts/index.js'
import { CheckpointService } from '../../domain/checkpoints/index.js'
import { WorkUnitService } from '../../domain/work-units/index.js'
import { NotFoundError } from '../../protocol/errors/protocol-error.js'
import { Artifact, Checkpoint, WorkUnit } from '../../protocol/schema/index.js'
import type { WorkId } from '../../protocol/schema/index.js'
import type { WorkUnitServiceApi } from '../../domain/work-units/index.js'
import { authorize, ok, pathParam, respond } from './route-support.js'

const workIdParam = () =>
  Effect.map(pathParam('work_id'), (workId) => workId as WorkId)

const requireWork = (work: WorkUnitServiceApi, workId: WorkId) =>
  Effect.flatMap(work.get(workId), (stored) =>
    Option.match(stored, {
      onNone: () =>
        Effect.fail(new NotFoundError({ entity: 'work', id: workId })),
      onSome: Effect.succeed,
    }),
  )

export const getWork = respond(
  Effect.gen(function* () {
    const work = yield* WorkUnitService
    const workId = yield* workIdParam()
    yield* authorize('workspace:read')
    const found = yield* requireWork(work, workId)
    return yield* ok(200)(WorkUnit, found)
  }),
)

export const listWorkCheckpoints = respond(
  Effect.gen(function* () {
    const work = yield* WorkUnitService
    const checkpoints = yield* CheckpointService
    const workId = yield* workIdParam()
    yield* authorize('workspace:read')
    yield* requireWork(work, workId)
    const found = yield* checkpoints.listForWork(workId)
    return yield* ok(200)(Schema.Array(Checkpoint), found)
  }),
)

export const latestWorkCheckpoint = respond(
  Effect.gen(function* () {
    const work = yield* WorkUnitService
    const checkpoints = yield* CheckpointService
    const workId = yield* workIdParam()
    yield* authorize('workspace:read')
    yield* requireWork(work, workId)
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

export const listWorkArtifacts = respond(
  Effect.gen(function* () {
    const work = yield* WorkUnitService
    const artifacts = yield* ArtifactService
    const workId = yield* workIdParam()
    yield* authorize('workspace:read')
    yield* requireWork(work, workId)
    const found = yield* artifacts.listForWork(workId)
    return yield* ok(200)(Schema.Array(Artifact), found)
  }),
)
