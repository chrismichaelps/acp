/** @Acp.Domain.WorkUnits.SpawnGraph.Test — lineage, depth cap, completion gate */
import { describe, expect, it } from 'vitest'
import { Chunk, Effect, Option } from 'effect'
import { EventStore } from '../events/index.js'
import { Storage } from '../../infrastructure/storage/index.js'
import type { WorkState } from '../../protocol/schema/index.js'
import { WorkUnitService } from './index.js'
import {
  create,
  failureOf,
  failureTag,
  id,
  now,
  otherWorkspaceId,
  run,
  runExit,
  seedWork,
  toRunning,
  transition,
  workerId,
  workspaceId,
} from './work-unit-spawn-graph-test-support.js'

describe('WorkUnitService spawn graph — lineage', () => {
  it('creates a root work unit at depth 0 with no parent', () => {
    const root = run(create('work_root'))
    expect(root.depth).toBe(0)
    expect(Option.isNone(root.parent_id)).toBe(true)
  })

  it('records parent_id and derives depth for a child', () => {
    const child = run(
      Effect.gen(function* () {
        yield* create('work_parent')
        yield* toRunning('work_parent')
        return yield* create('work_child', id('work_parent'))
      }),
    )
    expect(Option.getOrNull(child.parent_id)).toBe('work_parent')
    expect(child.depth).toBe(1)
  })

  it('carries parent_id and depth in the work.created event', () => {
    const data = run(
      Effect.gen(function* () {
        yield* create('work_parent')
        yield* toRunning('work_parent')
        yield* create('work_child', id('work_parent'))
        const events = yield* EventStore
        const log = yield* events.readAfter(workspaceId, 0)
        return Chunk.toReadonlyArray(log)
      }),
    )
    const created = data.find(
      (event) =>
        event.type === 'work.created' &&
        (event.data as { work_id?: string }).work_id === 'work_child',
    )
    expect(created?.data).toMatchObject({
      parent_id: 'work_parent',
      depth: 1,
    })
  })
})

describe('WorkUnitService spawn graph — creation invariants', () => {
  it('rejects a child whose parent does not exist', () => {
    expect(failureTag(runExit(create('work_child', id('work_missing'))))).toBe(
      'NotFoundError',
    )
  })

  it('rejects a child in a different workspace from its parent', () => {
    const exit = runExit(
      Effect.gen(function* () {
        yield* create('work_parent')
        yield* toRunning('work_parent')
        return yield* create('work_child', id('work_parent'), otherWorkspaceId)
      }),
    )
    expect(failureTag(exit)).toBe('ValidationError')
  })

  it('rejects a child that would exceed the configured depth cap', () => {
    const exit = runExit(
      Effect.gen(function* () {
        yield* create('work_d0')
        yield* toRunning('work_d0')
        yield* create('work_d1', id('work_d0'))
        yield* toRunning('work_d1')
        return yield* create('work_d2', id('work_d1'))
      }),
      1,
    )
    expect(failureTag(exit)).toBe('DepthLimitExceededError')
  })

  it('admits a child exactly at the depth cap', () => {
    const child = run(
      Effect.gen(function* () {
        yield* create('work_d0')
        yield* toRunning('work_d0')
        return yield* create('work_d1', id('work_d0'))
      }),
      1,
    )
    expect(child.depth).toBe(1)
  })

  it.each(['completed', 'cancelled', 'rejected', 'needs_review', 'approved'])(
    'rejects a child when the parent is %s',
    (state) => {
      const exit = runExit(
        Effect.gen(function* () {
          yield* create('work_parent')
          if (state === 'cancelled') {
            yield* transition('work_parent', 'cancelled')
          } else {
            yield* toRunning('work_parent')
            yield* transition('work_parent', 'needs_review')
            if (state === 'rejected') {
              yield* transition('work_parent', 'rejected')
            } else if (state === 'approved' || state === 'completed') {
              yield* transition('work_parent', 'approved')
              if (state === 'completed') {
                yield* transition('work_parent', 'completed')
              }
            }
          }
          return yield* create('work_child', id('work_parent'))
        }),
      )
      expect(failureTag(exit)).toBe('InvalidStateTransitionError')
    },
  )

  it.each(['open', 'claimed', 'running', 'blocked', 'changes_requested'])(
    'admits a child when the parent is %s',
    (state) => {
      const child = run(
        Effect.gen(function* () {
          const svc = yield* WorkUnitService
          yield* create('work_parent')
          if (state !== 'open') {
            yield* svc.claim(id('work_parent'), workerId, now)
          }
          if (state === 'running' || state === 'blocked') {
            yield* transition('work_parent', 'running')
          }
          if (state === 'blocked') {
            yield* transition('work_parent', 'blocked')
          }
          if (state === 'changes_requested') {
            yield* transition('work_parent', 'running')
            yield* transition('work_parent', 'needs_review')
            yield* transition('work_parent', 'changes_requested')
          }
          return yield* create('work_child', id('work_parent'))
        }),
      )
      expect(child.depth).toBe(1)
    },
  )
})

describe('WorkUnitService spawn graph — completion gate', () => {
  const parentWithChild = (childState: WorkState) =>
    Effect.gen(function* () {
      yield* create('work_parent')
      yield* toRunning('work_parent')
      yield* create('work_child', id('work_parent'))
      if (childState !== 'open') {
        yield* transition('work_child', childState)
      }
    })

  it('blocks needs_review while a direct child is non-terminal', () => {
    const exit = runExit(
      Effect.gen(function* () {
        yield* parentWithChild('open')
        return yield* transition('work_parent', 'needs_review')
      }),
    )
    expect(failureTag(exit)).toBe('IncompleteChildrenError')
  })

  // The creation invariant means a parent cannot reach `approved` with a live
  // child through the public API, so the `completed` gate is defence in depth
  // against rows written by another path — including rows that predate this
  // feature. Seeding storage directly is the only way to reach it, and is
  // exactly the situation the second gate exists for.
  it('blocks completed on a seeded approved parent with a live child', () => {
    const exit = runExit(
      Effect.gen(function* () {
        const storage = yield* Storage
        yield* seedWork(storage, {
          id: 'work_parent',
          state: 'approved',
          depth: 0,
        })
        yield* seedWork(storage, {
          id: 'work_child',
          state: 'running',
          depth: 1,
          parent_id: 'work_parent',
        })
        return yield* transition('work_parent', 'completed')
      }),
    )
    expect(failureTag(exit)).toBe('IncompleteChildrenError')
  })

  it('permits completed on a seeded approved parent whose children terminated', () => {
    const parent = run(
      Effect.gen(function* () {
        const storage = yield* Storage
        yield* seedWork(storage, {
          id: 'work_parent',
          state: 'approved',
          depth: 0,
        })
        yield* seedWork(storage, {
          id: 'work_child',
          state: 'completed',
          depth: 1,
          parent_id: 'work_parent',
        })
        return yield* transition('work_parent', 'completed')
      }),
    )
    expect(parent.state).toBe('completed')
  })

  it.each(['completed', 'cancelled', 'rejected'])(
    'permits needs_review once the only child is %s',
    (childState) => {
      const parent = run(
        Effect.gen(function* () {
          yield* create('work_parent')
          yield* toRunning('work_parent')
          yield* create('work_child', id('work_parent'))
          if (childState === 'cancelled') {
            yield* transition('work_child', 'cancelled')
          } else {
            yield* toRunning('work_child')
            yield* transition('work_child', 'needs_review')
            if (childState === 'rejected') {
              yield* transition('work_child', 'rejected')
            } else {
              yield* transition('work_child', 'approved')
              yield* transition('work_child', 'completed')
            }
          }
          return yield* transition('work_parent', 'needs_review')
        }),
      )
      expect(parent.state).toBe('needs_review')
    },
  )

  it.each(['open', 'claimed', 'running', 'blocked'])(
    'blocks needs_review while a child is %s',
    (childState) => {
      const exit = runExit(
        Effect.gen(function* () {
          const svc = yield* WorkUnitService
          yield* create('work_parent')
          yield* toRunning('work_parent')
          yield* create('work_child', id('work_parent'))
          if (childState !== 'open') {
            yield* svc.claim(id('work_child'), workerId, now)
          }
          if (childState === 'running' || childState === 'blocked') {
            yield* transition('work_child', 'running')
          }
          if (childState === 'blocked') {
            yield* transition('work_child', 'blocked')
          }
          return yield* transition('work_parent', 'needs_review')
        }),
      )
      expect(failureTag(exit)).toBe('IncompleteChildrenError')
    },
  )

  it('leaves parent state and the event log untouched when the gate refuses', () => {
    const result = run(
      Effect.gen(function* () {
        const svc = yield* WorkUnitService
        const events = yield* EventStore
        yield* create('work_parent')
        yield* toRunning('work_parent')
        yield* create('work_child', id('work_parent'))
        const before = Chunk.toReadonlyArray(
          yield* events.readAfter(workspaceId, 0),
        ).length
        yield* Effect.either(
          svc.transition(id('work_parent'), 'needs_review', workerId, now),
        )
        const after = Chunk.toReadonlyArray(
          yield* events.readAfter(workspaceId, 0),
        ).length
        const parent = yield* svc.get(id('work_parent'))
        return { before, after, state: Option.getOrNull(parent)?.state }
      }),
    )
    expect(result.after).toBe(result.before)
    expect(result.state).toBe('running')
  })

  it('leaves a childless parent unaffected', () => {
    const parent = run(
      Effect.gen(function* () {
        yield* create('work_solo')
        yield* toRunning('work_solo')
        return yield* transition('work_solo', 'needs_review')
      }),
    )
    expect(parent.state).toBe('needs_review')
  })

  it('reports the blocking children on refusal', () => {
    const exit = runExit(
      Effect.gen(function* () {
        yield* create('work_parent')
        yield* toRunning('work_parent')
        yield* create('work_child_a', id('work_parent'))
        yield* create('work_child_b', id('work_parent'))
        return yield* transition('work_parent', 'needs_review')
      }),
    )
    const error = failureOf(exit) as {
      readonly blockingChildren: readonly string[]
      readonly blockingChildCount: number
    }
    expect(error.blockingChildCount).toBe(2)
    expect([...error.blockingChildren].sort()).toEqual([
      'work_child_a',
      'work_child_b',
    ])
  })
})

describe('WorkUnitService spawn graph — queries', () => {
  const tree = Effect.gen(function* () {
    yield* create('work_root')
    yield* toRunning('work_root')
    yield* create('work_a', id('work_root'))
    yield* create('work_b', id('work_root'))
    yield* toRunning('work_a')
    yield* create('work_a1', id('work_a'))
  })

  it('lists direct children only', () => {
    const children = run(
      Effect.gen(function* () {
        const svc = yield* WorkUnitService
        yield* tree
        return yield* svc.listChildren(id('work_root'))
      }),
    )
    expect(children.map((child) => child.id)).toEqual(['work_a', 'work_b'])
  })

  it('lists descendants breadth-first ordered by depth then id', () => {
    const descendants = run(
      Effect.gen(function* () {
        const svc = yield* WorkUnitService
        yield* tree
        return yield* svc.listDescendants(id('work_root'))
      }),
    )
    expect(descendants.map((unit) => unit.id)).toEqual([
      'work_a',
      'work_b',
      'work_a1',
    ])
  })

  it('bounds descendant traversal by maxDepth', () => {
    const descendants = run(
      Effect.gen(function* () {
        const svc = yield* WorkUnitService
        yield* tree
        return yield* svc.listDescendants(id('work_root'), { maxDepth: 1 })
      }),
    )
    expect(descendants.map((unit) => unit.id)).toEqual(['work_a', 'work_b'])
  })

  it('bounds descendant results by limit', () => {
    const descendants = run(
      Effect.gen(function* () {
        const svc = yield* WorkUnitService
        yield* tree
        return yield* svc.listDescendants(id('work_root'), { limit: 2 })
      }),
    )
    expect(descendants.map((unit) => unit.id)).toEqual(['work_a', 'work_b'])
  })

  it('treats a row written before this feature as a childless root', () => {
    const result = run(
      Effect.gen(function* () {
        const svc = yield* WorkUnitService
        const storage = yield* Storage
        yield* seedWork(storage, {
          id: 'work_legacy',
          state: 'running',
          omitLineage: true,
        })
        const legacy = yield* svc.get(id('work_legacy'))
        const children = yield* svc.listChildren(id('work_legacy'))
        const reviewed = yield* svc.transition(
          id('work_legacy'),
          'needs_review',
          workerId,
          now,
        )
        return { legacy: Option.getOrThrow(legacy), children, reviewed }
      }),
    )
    expect(result.legacy.depth).toBe(0)
    expect(Option.isNone(result.legacy.parent_id)).toBe(true)
    expect(result.children).toEqual([])
    expect(result.reviewed.state).toBe('needs_review')
  })

  it('returns no children for a leaf', () => {
    const children = run(
      Effect.gen(function* () {
        const svc = yield* WorkUnitService
        yield* tree
        return yield* svc.listChildren(id('work_b'))
      }),
    )
    expect(children).toEqual([])
  })
})
