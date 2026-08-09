/** @Acp.Domain.WorkUnits.Service — WorkUnit persistence + state machine */
import { Chunk, Context, Effect, Layer, Option, Schema } from 'effect'
import { AppConfigTag } from '../../config/app-config.js'
import { HookDispatcher } from '../hooks/index.js'
import { WorkerIdentityService } from '../identity/index.js'
import { CostService } from '../cost/index.js'
import {
  allowedTransitions,
  childGatedTargets,
  eventTypeForTransition,
} from './work-unit-states.js'
import {
  makeSpawnGraph,
  newWorkUnit,
  planSubtreeCancellation,
} from './work-unit-spawn-graph.js'
import type { ListDescendantsOptions } from './work-unit-spawn-graph.js'
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
  WorkerAssertionPayload,
  EventType,
  Timestamp,
  WorkId,
  WorkerId,
  WorkspaceId,
  WorkState,
} from '../../protocol/schema/index.js'
import type {
  CancelSubtreeResult,
  CreateWorkInput,
  WorkUnitClaimError,
  WorkUnitCreateError,
  WorkUnitTransitionError,
} from './work-unit-service-types.js'

export type {
  CancelSubtreeResult,
  CreateWorkInput,
  WorkUnitClaimError,
  WorkUnitCreateError,
  WorkUnitTransitionError,
} from './work-unit-service-types.js'

export interface WorkUnitServiceApi {
  readonly create: (
    input: CreateWorkInput,
  ) => Effect.Effect<WorkUnit, WorkUnitCreateError>
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
    /** Provenance for the claim; required when signatures are enforced. */
    assertion?: WorkerAssertionPayload,
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
  /**
   * Runs the same checks as `transition` — legality and the spawn-graph
   * completion gate — without writing anything, so a caller that must persist
   * other state alongside a transition can refuse before it does.
   */
  readonly canTransition: (
    workId: WorkId,
    to: WorkState,
  ) => Effect.Effect<void, WorkUnitTransitionError>
  /**
   * Cancels a work unit and its descendants, deepest-first, cancelling the root
   * only when nothing was blocked — see [[ADR-0027-subtree-cancellation]].
   * Not atomic; idempotent instead, so a partial cascade is safe to re-run.
   */
  readonly cancelSubtree: (
    workId: WorkId,
    actor: WorkerId,
    now: Timestamp,
  ) => Effect.Effect<CancelSubtreeResult, WorkUnitTransitionError>
  /** Direct children of `workId`, ordered by id. */
  readonly listChildren: (
    workId: WorkId,
  ) => Effect.Effect<readonly WorkUnit[], StorageError>
  /** Descendants breadth-first, ordered by `(depth, id)`. */
  readonly listDescendants: (
    workId: WorkId,
    opts?: ListDescendantsOptions,
  ) => Effect.Effect<readonly WorkUnit[], StorageError>
}

export class WorkUnitService extends Context.Tag('WorkUnitService')<
  WorkUnitService,
  WorkUnitServiceApi
>() {}

const collection = 'work'

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
  const config = yield* AppConfigTag
  const hooks = yield* HookDispatcher
  const identity = yield* WorkerIdentityService
  const cost = yield* CostService

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
    extra: Record<string, unknown> = {},
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
        data: { work_id: work.id, state: work.state, ...extra },
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

  const listForWorkspace: WorkUnitServiceApi['listForWorkspace'] = (
    workspaceId,
  ) =>
    Effect.flatMap(
      storage.queryBy(collection, [
        { field: 'workspace_id', value: workspaceId },
      ]),
      (stored) =>
        Effect.forEach(Chunk.toReadonlyArray(stored), decodeStoredWork),
    )

  const requireWork = (workId: WorkId) =>
    Effect.flatMap(get(workId), (work) =>
      Option.match(work, {
        onNone: () =>
          Effect.fail(new NotFoundError({ entity: 'work', id: workId })),
        onSome: Effect.succeed,
      }),
    )

  const graph = makeSpawnGraph({
    storage,
    collection,
    maxWorkDepth: config.maxWorkDepth,
    decodeStoredWork,
    requireWork,
  })

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

  const create: WorkUnitServiceApi['create'] = (input) =>
    Effect.gen(function* () {
      const depth = yield* graph.resolveDepth(
        input.payload.parent_id,
        input.payload.workspace_id,
      )
      const work = newWorkUnit(input, depth)
      yield* save(work)
      yield* appendWorkEvent(work, input.createdBy, input.now, 'work.created', {
        parent_id: Option.getOrNull(work.parent_id),
        depth,
      })
      return work
    })

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

      if (childGatedTargets.has(to)) {
        yield* graph.assertChildrenComplete(work.id, to)
      }

      // Budgets gate entry into execution. Work already running is never
      // interrupted when later reports exhaust its budget.
      if (to === 'claimed' || to === 'running') {
        yield* cost.checkAdmission(work.id, actor, now)
      }

      yield* hooks.dispatch('work.before_transition', {
        point: 'work.before_transition',
        workspaceId: work.workspace_id,
        actor,
        subjectId: work.id,
        detail: { from: work.state, to },
      })

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

  const claim: WorkUnitServiceApi['claim'] = (
    workId,
    workerId,
    now,
    assertion,
  ) =>
    Effect.gen(function* () {
      const { work, version } = yield* requireVersionedWork(workId)

      // Provenance is checked in the domain so every transport inherits it,
      // and after the session has already authorized the call: a signature
      // never grants access, it only attributes — see
      // [[ADR-0024-worker-identity-provenance]].
      yield* identity.verify({
        workerId,
        action: 'work.claim',
        targetId: workId,
        assertion:
          assertion === undefined
            ? Option.none()
            : Option.some({
                workerId: assertion.worker_id,
                action: assertion.action,
                targetId: assertion.target_id,
                timestamp: assertion.timestamp,
                signature: assertion.signature,
              }),
        now,
      })
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

      yield* cost.checkAdmission(work.id, workerId, now)

      yield* hooks.dispatch('work.before_claim', {
        point: 'work.before_claim',
        workspaceId: work.workspace_id,
        actor: workerId,
        subjectId: work.id,
        detail: { from: work.state },
      })

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

  const canTransition: WorkUnitServiceApi['canTransition'] = (workId, to) =>
    Effect.gen(function* () {
      const work = yield* requireWork(workId)
      if (!allowedTransitions[work.state].has(to)) {
        return yield* Effect.fail(
          new InvalidStateTransitionError({ from: work.state, to }),
        )
      }
      if (childGatedTargets.has(to)) {
        yield* graph.assertChildrenComplete(workId, to)
      }
    })

  const cancelSubtree: WorkUnitServiceApi['cancelSubtree'] = (
    workId,
    actor,
    now,
  ) =>
    Effect.gen(function* () {
      const root = yield* requireWork(workId)
      const plan = planSubtreeCancellation(
        root,
        yield* graph.listDescendants(workId),
      )
      // Not atomic — the storage port exposes no cross-row transaction — so a
      // partial cascade is left safe to re-run rather than claimed as complete.
      const cancelled: WorkId[] = []
      for (const unit of plan.toCancel) {
        yield* transitionWork(unit, 'cancelled', actor, now)
        cancelled.push(unit.id)
      }
      return { cancelled, blocked: plan.blocked }
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
    canTransition,
    cancelSubtree,
    listChildren: graph.listChildren,
    listDescendants: graph.listDescendants,
  } satisfies WorkUnitServiceApi
})

export const WorkUnitServiceLive: Layer.Layer<
  WorkUnitService,
  never,
  | Storage
  | EventStore
  | AppConfigTag
  | HookDispatcher
  | WorkerIdentityService
  | CostService
> = Layer.effect(WorkUnitService, make)
