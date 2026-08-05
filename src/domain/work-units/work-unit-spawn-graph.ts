/** @Acp.Domain.WorkUnits.SpawnGraph — parent/child lineage, depth, completion gate */
import { Chunk, Effect, Option } from 'effect'
import type { StorageApi } from '../../infrastructure/storage/index.js'
import type {
  NotFoundError,
  StorageError,
} from '../../protocol/errors/protocol-error.js'
import {
  DepthLimitExceededError,
  IncompleteChildrenError,
  InvalidStateTransitionError,
  ValidationError,
} from '../../protocol/errors/protocol-error.js'
import type { WorkUnit } from '../../protocol/schema/index.js'
import type {
  WorkId,
  WorkspaceId,
  WorkState,
} from '../../protocol/schema/index.js'
import { childAcceptingStates, isTerminal } from './work-unit-states.js'

/** Bounds the `blockingChildren` list so a refusal payload stays small. */
const maxReportedBlockingChildren = 10

/** Ceiling on `listDescendants` results when the caller supplies none. */
export const DEFAULT_DESCENDANT_LIMIT = 1000

export interface ListDescendantsOptions {
  /** Levels below the root to walk. Defaults to the configured depth cap. */
  readonly maxDepth?: number
  /** Maximum units returned. Defaults to `DEFAULT_DESCENDANT_LIMIT`. */
  readonly limit?: number
}

export type ResolveDepthError =
  | NotFoundError
  | ValidationError
  | InvalidStateTransitionError
  | DepthLimitExceededError
  | StorageError

export interface SpawnGraphDeps {
  readonly storage: StorageApi
  readonly collection: string
  readonly maxWorkDepth: number
  readonly decodeStoredWork: (
    value: unknown,
  ) => Effect.Effect<WorkUnit, StorageError>
  readonly requireWork: (
    workId: WorkId,
  ) => Effect.Effect<WorkUnit, NotFoundError | StorageError>
}

/**
 * The spawn-graph half of the work unit domain: who spawned whom, how deep the
 * tree may go, and whether a parent's children permit it to finish.
 *
 * Kept separate from the service so the lineage rules can be read and changed
 * without wading through persistence and the state machine.
 */
export const makeSpawnGraph = (deps: SpawnGraphDeps) => {
  const { storage, collection, maxWorkDepth, decodeStoredWork, requireWork } =
    deps

  const listChildren = (
    workId: WorkId,
  ): Effect.Effect<readonly WorkUnit[], StorageError> =>
    Effect.flatMap(
      storage.queryBy(collection, [{ field: 'parent_id', value: workId }]),
      (stored) =>
        Effect.forEach(Chunk.toReadonlyArray(stored), decodeStoredWork),
    )

  const listDescendants = (
    workId: WorkId,
    opts?: ListDescendantsOptions,
  ): Effect.Effect<readonly WorkUnit[], StorageError> =>
    Effect.gen(function* () {
      const maxDepth = opts?.maxDepth ?? maxWorkDepth
      const limit = opts?.limit ?? DEFAULT_DESCENDANT_LIMIT
      const collected: WorkUnit[] = []
      let frontier: readonly WorkId[] = [workId]

      for (
        let level = 1;
        level <= maxDepth && frontier.length > 0 && collected.length < limit;
        level += 1
      ) {
        const found: WorkUnit[] = []
        for (const parentId of frontier) {
          found.push(...(yield* listChildren(parentId)))
        }
        // Each queryBy is id-ordered, but a level draws from several parents,
        // so the level is re-sorted to keep the documented (depth, id) order.
        found.sort((left, right) =>
          left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
        )
        for (const unit of found) {
          if (collected.length >= limit) break
          collected.push(unit)
        }
        frontier = found.map((unit) => unit.id)
      }
      return collected
    })

  /**
   * Validates a requested parent link and returns the child's depth. Enforces,
   * in order: the parent exists, shares the child's workspace, still accepts
   * children, and leaves the result within the configured depth cap.
   */
  const resolveDepth = (
    parentId: Option.Option<WorkId>,
    workspaceId: WorkspaceId,
  ): Effect.Effect<number, ResolveDepthError> =>
    Option.match(parentId, {
      onNone: () => Effect.succeed(0),
      onSome: (parent) =>
        Effect.gen(function* () {
          const found = yield* requireWork(parent)
          if (found.workspace_id !== workspaceId) {
            return yield* Effect.fail(
              new ValidationError({
                issues: [
                  `parent ${parent} belongs to workspace ${found.workspace_id}, not ${workspaceId}`,
                ],
              }),
            )
          }
          if (!childAcceptingStates.has(found.state)) {
            return yield* Effect.fail(
              new InvalidStateTransitionError({
                from: found.state,
                to: 'spawn_child',
              }),
            )
          }
          const depth = found.depth + 1
          if (depth > maxWorkDepth) {
            return yield* Effect.fail(
              new DepthLimitExceededError({
                parentId: parent,
                depth,
                maxDepth: maxWorkDepth,
              }),
            )
          }
          return depth
        }),
    })

  /**
   * Fails when a direct child is non-terminal. Only direct children are checked:
   * a live grandchild already pins its own parent non-terminal, which pins this
   * unit transitively, so walking the subtree would pay twice for one guarantee.
   */
  const assertChildrenComplete = (
    workId: WorkId,
    to: WorkState,
  ): Effect.Effect<void, IncompleteChildrenError | StorageError> =>
    Effect.flatMap(listChildren(workId), (children) => {
      const blocking = children.filter((child) => !isTerminal(child.state))
      return blocking.length === 0
        ? Effect.void
        : Effect.fail(
            new IncompleteChildrenError({
              workId,
              to,
              blockingChildren: blocking
                .slice(0, maxReportedBlockingChildren)
                .map((child) => child.id),
              blockingChildCount: blocking.length,
            }),
          )
    })

  return { listChildren, listDescendants, resolveDepth, assertChildrenComplete }
}
