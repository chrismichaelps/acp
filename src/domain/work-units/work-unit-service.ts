/** @Acp.Domain.WorkUnits.Service — WorkUnit persistence + state machine */
import { Chunk, Context, Effect, Layer, Option, Schema } from 'effect'
import { EventStore } from '../events/index.js'
import { Storage } from '../../infrastructure/storage/index.js'
import {
  ClaimConflictError,
  InvalidStateTransitionError,
  NotFoundError,
  StorageError,
} from '../../protocol/errors/protocol-error.js'
import { Event, WorkUnit } from '../../protocol/schema/index.js'
import type {
  CreateWorkPayload,
  EventType,
  Timestamp,
  WorkId,
  WorkerId,
  WorkspaceId,
  WorkState,
} from '../../protocol/schema/index.js'

export interface CreateWorkInput {
  readonly id: WorkId
  readonly payload: CreateWorkPayload
  readonly createdBy: WorkerId
  readonly now: Timestamp
}

export type WorkUnitClaimError =
  | NotFoundError
  | ClaimConflictError
  | InvalidStateTransitionError
  | StorageError

export type WorkUnitTransitionError =
  | NotFoundError
  | InvalidStateTransitionError
  | StorageError

export interface WorkUnitServiceApi {
  readonly create: (
    input: CreateWorkInput,
  ) => Effect.Effect<WorkUnit, StorageError>
  readonly get: (
    workId: WorkId,
  ) => Effect.Effect<Option.Option<WorkUnit>, StorageError>
  readonly listForWorkspace: (
    workspaceId: WorkspaceId,
  ) => Effect.Effect<readonly WorkUnit[], StorageError>
  readonly claim: (
    workId: WorkId,
    workerId: WorkerId,
    now: Timestamp,
  ) => Effect.Effect<WorkUnit, WorkUnitClaimError>
  readonly transition: (
    workId: WorkId,
    to: WorkState,
    actor: WorkerId,
    now: Timestamp,
  ) => Effect.Effect<WorkUnit, WorkUnitTransitionError>
  readonly transitionSilently: (
    workId: WorkId,
    to: WorkState,
    actor: WorkerId,
    now: Timestamp,
  ) => Effect.Effect<WorkUnit, WorkUnitTransitionError>
}

export class WorkUnitService extends Context.Tag('WorkUnitService')<
  WorkUnitService,
  WorkUnitServiceApi
>() {}

const collection = 'work'

const allowedTransitions: Record<WorkState, ReadonlySet<WorkState>> = {
  open: new Set(['claimed', 'cancelled']),
  claimed: new Set(['running', 'cancelled']),
  running: new Set(['blocked', 'needs_review', 'cancelled']),
  blocked: new Set(['running']),
  needs_review: new Set([
    'running',
    'approved',
    'rejected',
    'changes_requested',
  ]),
  changes_requested: new Set(['running']),
  approved: new Set(['completed']),
  rejected: new Set(),
  completed: new Set(),
  cancelled: new Set(),
}

const eventTypeForTransition = (from: WorkState, to: WorkState): EventType => {
  switch (to) {
    case 'claimed':
      return 'work.claimed'
    case 'running':
      return from === 'claimed' ? 'work.started' : 'work.unblocked'
    case 'blocked':
      return 'work.blocked'
    case 'needs_review':
      return 'work.needs_review'
    case 'changes_requested':
      return 'review.changes_requested'
    case 'approved':
      return 'review.approved'
    case 'rejected':
      return 'review.rejected'
    case 'completed':
      return 'work.completed'
    case 'cancelled':
      return 'work.cancelled'
    case 'open':
      return 'work.created'
  }
}

const decodeStoredWork = (value: unknown) =>
  Schema.decodeUnknown(WorkUnit)(value).pipe(
    Effect.mapError(
      (error) =>
        new StorageError({
          op: 'decode_work_unit',
          cause: String(error),
        }),
    ),
  )

const make = Effect.gen(function* () {
  const storage = yield* Storage
  const events = yield* EventStore

  const encodeWork = (work: WorkUnit) =>
    Schema.encode(WorkUnit)(work).pipe(
      Effect.mapError(
        (error) =>
          new StorageError({
            op: 'encode_work_unit',
            cause: String(error),
          }),
      ),
    )

  const save = (work: WorkUnit) =>
    Effect.flatMap(encodeWork(work), (encoded) =>
      storage.put(collection, work.id, encoded),
    )

  const appendWorkEvent = (
    work: WorkUnit,
    actor: WorkerId,
    timestamp: Timestamp,
    type: EventType,
  ) =>
    Effect.flatMap(
      Schema.decodeUnknown(Event)({
        id: `event_${work.id}_${type}_${timestamp}`,
        type,
        workspace_id: work.workspace_id,
        work_id: work.id,
        actor,
        timestamp,
        seq: 0,
        data: { work_id: work.id, state: work.state },
      }).pipe(
        Effect.mapError(
          (error) =>
            new StorageError({
              op: 'decode_work_event',
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

  const get: WorkUnitServiceApi['get'] = (workId) =>
    Effect.flatMap(storage.get(collection, workId), (stored) =>
      Option.match(stored, {
        onNone: () => Effect.succeed(Option.none<WorkUnit>()),
        onSome: (value) => Effect.map(decodeStoredWork(value), Option.some),
      }),
    )

  const all = () =>
    Effect.flatMap(storage.list(collection), (stored) =>
      Effect.forEach(Chunk.toReadonlyArray(stored), decodeStoredWork),
    )

  const listForWorkspace: WorkUnitServiceApi['listForWorkspace'] = (
    workspaceId,
  ) =>
    Effect.map(all(), (workUnits) =>
      workUnits.filter((work) => work.workspace_id === workspaceId),
    )

  const requireWork = (workId: WorkId) =>
    Effect.flatMap(get(workId), (work) =>
      Option.match(work, {
        onNone: () =>
          Effect.fail(new NotFoundError({ entity: 'work', id: workId })),
        onSome: Effect.succeed,
      }),
    )

  interface VersionedWork {
    readonly work: WorkUnit
    readonly version: number
  }

  const getVersionedWork = (workId: WorkId) =>
    Effect.flatMap(storage.getVersioned(collection, workId), (stored) =>
      Option.match(stored, {
        onNone: () => Effect.succeed(Option.none<VersionedWork>()),
        onSome: ({ value, version }) =>
          Effect.map(decodeStoredWork(value), (work) =>
            Option.some({ work, version }),
          ),
      }),
    )

  /** Like `requireWork`, but also returns the row's version for CAS writes. */
  const requireVersionedWork = (workId: WorkId) =>
    Effect.flatMap(getVersionedWork(workId), (versioned) =>
      Option.match(versioned, {
        onNone: () =>
          Effect.fail(new NotFoundError({ entity: 'work', id: workId })),
        onSome: Effect.succeed,
      }),
    )

  const create: WorkUnitServiceApi['create'] = (input) => {
    const work: WorkUnit = {
      id: input.id,
      workspace_id: input.payload.workspace_id,
      title: input.payload.title,
      description: input.payload.description,
      state: 'open',
      priority: Option.getOrElse(input.payload.priority, () => 'normal'),
      created_by: input.createdBy,
      assigned_to: Option.none(),
      created_at: input.now,
      updated_at: input.now,
    }

    return Effect.gen(function* () {
      yield* save(work)
      yield* appendWorkEvent(work, input.createdBy, input.now, 'work.created')
      return work
    })
  }

  const transitionWork = (
    work: WorkUnit,
    to: WorkState,
    actor: WorkerId,
    now: Timestamp,
    assignedTo: Option.Option<WorkerId> = work.assigned_to,
    emitEvent = true,
  ) =>
    Effect.gen(function* () {
      if (!allowedTransitions[work.state].has(to)) {
        return yield* Effect.fail(
          new InvalidStateTransitionError({ from: work.state, to }),
        )
      }

      const next: WorkUnit = {
        ...work,
        state: to,
        assigned_to: assignedTo,
        updated_at: now,
      }

      yield* save(next)
      if (emitEvent) {
        yield* appendWorkEvent(
          next,
          actor,
          now,
          eventTypeForTransition(work.state, to),
        )
      }
      return next
    })

  const claim: WorkUnitServiceApi['claim'] = (workId, workerId, now) =>
    Effect.gen(function* () {
      const { work, version } = yield* requireVersionedWork(workId)
      if (work.state !== 'open' && Option.isSome(work.assigned_to)) {
        return yield* Effect.fail(
          new ClaimConflictError({
            workId,
            holderWorkerId: work.assigned_to.value,
          }),
        )
      }
      if (!allowedTransitions[work.state].has('claimed')) {
        return yield* Effect.fail(
          new InvalidStateTransitionError({
            from: work.state,
            to: 'claimed',
          }),
        )
      }

      const next: WorkUnit = {
        ...work,
        state: 'claimed',
        assigned_to: Option.some(workerId),
        updated_at: now,
      }
      const replacement = yield* encodeWork(next)
      const replaced = yield* storage.replaceIfVersion(
        collection,
        work.id,
        version,
        replacement,
      )
      if (!replaced) {
        const current = yield* requireWork(workId)
        return yield* Effect.fail(
          new ClaimConflictError({
            workId,
            holderWorkerId: Option.getOrElse(
              current.assigned_to,
              () => workerId,
            ),
          }),
        )
      }

      yield* appendWorkEvent(next, workerId, now, 'work.claimed')
      return next
    })

  const transition: WorkUnitServiceApi['transition'] = (
    workId,
    to,
    actor,
    now,
  ) =>
    Effect.flatMap(requireWork(workId), (work) =>
      transitionWork(work, to, actor, now),
    )

  const transitionSilently: WorkUnitServiceApi['transitionSilently'] = (
    workId,
    to,
    actor,
    now,
  ) =>
    Effect.flatMap(requireWork(workId), (work) =>
      transitionWork(work, to, actor, now, work.assigned_to, false),
    )

  return {
    create,
    get,
    listForWorkspace,
    claim,
    transition,
    transitionSilently,
  } satisfies WorkUnitServiceApi
})

export const WorkUnitServiceLive: Layer.Layer<
  WorkUnitService,
  never,
  Storage | EventStore
> = Layer.effect(WorkUnitService, make)
