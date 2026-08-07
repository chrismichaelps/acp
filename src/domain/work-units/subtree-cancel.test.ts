/** @Acp.Domain.WorkUnits.SubtreeCancel.Test — cascade ordering and partiality */
import { describe, expect, it } from 'vitest'
import { Chunk, Effect, Option } from 'effect'
import { EventStore } from '../events/index.js'
import { WorkUnitService } from './index.js'
import {
  create,
  failureTag,
  id,
  now,
  run,
  runExit,
  toRunning,
  transition,
  workerId,
  workspaceId,
} from './work-unit-spawn-graph-test-support.js'

const cancelSubtree = (raw: string) =>
  Effect.flatMap(WorkUnitService, (svc) =>
    svc.cancelSubtree(id(raw), workerId, now),
  )

const stateOf = (raw: string) =>
  Effect.flatMap(WorkUnitService, (svc) =>
    Effect.map(svc.get(id(raw)), (found) => Option.getOrThrow(found).state),
  )

/** root → a → a1, plus a sibling b, all still cancellable. */
const tree = Effect.gen(function* () {
  yield* create('work_root')
  yield* toRunning('work_root')
  yield* create('work_a', id('work_root'))
  yield* create('work_b', id('work_root'))
  yield* toRunning('work_a')
  yield* create('work_a1', id('work_a'))
})

describe('subtree cancellation', () => {
  it('cancels every unit in the subtree including the root', () => {
    const result = run(
      Effect.gen(function* () {
        yield* tree
        const outcome = yield* cancelSubtree('work_root')
        return {
          outcome,
          states: {
            root: yield* stateOf('work_root'),
            a: yield* stateOf('work_a'),
            a1: yield* stateOf('work_a1'),
            b: yield* stateOf('work_b'),
          },
        }
      }),
    )
    expect(result.states).toEqual({
      root: 'cancelled',
      a: 'cancelled',
      a1: 'cancelled',
      b: 'cancelled',
    })
    expect(result.outcome.blocked).toEqual([])
    expect([...result.outcome.cancelled].sort()).toEqual([
      'work_a',
      'work_a1',
      'work_b',
      'work_root',
    ])
  })

  it('cancels descendants before their parents', () => {
    // Deepest-first, so a parent is never cancelled above a live child.
    const order = run(
      Effect.gen(function* () {
        yield* tree
        const outcome = yield* cancelSubtree('work_root')
        return outcome.cancelled
      }),
    )
    const at = (raw: string) => order.indexOf(id(raw))
    expect(at('work_a1')).toBeLessThan(at('work_a'))
    expect(at('work_a')).toBeLessThan(at('work_root'))
  })

  it('cancels a childless unit on its own', () => {
    const result = run(
      Effect.gen(function* () {
        yield* create('work_solo')
        const outcome = yield* cancelSubtree('work_solo')
        return { outcome, state: yield* stateOf('work_solo') }
      }),
    )
    expect(result.state).toBe('cancelled')
    expect(result.outcome.cancelled).toEqual(['work_solo'])
  })

  it('reports an uncancellable descendant and leaves the root alone', () => {
    // `needs_review` admits no `cancelled` edge, so the cascade must surface it
    // rather than force a transition the state machine forbids.
    const result = run(
      Effect.gen(function* () {
        yield* create('work_root')
        yield* toRunning('work_root')
        yield* create('work_a', id('work_root'))
        yield* toRunning('work_a')
        yield* transition('work_a', 'needs_review')
        const outcome = yield* cancelSubtree('work_root')
        return {
          outcome,
          root: yield* stateOf('work_root'),
          a: yield* stateOf('work_a'),
        }
      }),
    )
    expect(result.outcome.blocked).toEqual([
      { work_id: 'work_a', state: 'needs_review' },
    ])
    expect(result.a).toBe('needs_review')
    // The root stays live: a cancelled parent must never sit above a live child.
    expect(result.root).toBe('running')
    expect(result.outcome.cancelled).toEqual([])
  })

  it('skips an already-terminal descendant without reporting it', () => {
    const result = run(
      Effect.gen(function* () {
        yield* create('work_root')
        yield* toRunning('work_root')
        yield* create('work_a', id('work_root'))
        yield* transition('work_a', 'cancelled')
        return yield* cancelSubtree('work_root')
      }),
    )
    expect(result.blocked).toEqual([])
    expect(result.cancelled).toEqual(['work_root'])
  })

  it('is idempotent: re-running cancels nothing further and does not fail', () => {
    const second = run(
      Effect.gen(function* () {
        yield* tree
        yield* cancelSubtree('work_root')
        return yield* cancelSubtree('work_root')
      }),
    )
    expect(second.cancelled).toEqual([])
    expect(second.blocked).toEqual([])
  })

  it('resumes a partial cascade once the blocker clears', () => {
    const result = run(
      Effect.gen(function* () {
        yield* create('work_root')
        yield* toRunning('work_root')
        yield* create('work_a', id('work_root'))
        yield* toRunning('work_a')
        yield* transition('work_a', 'needs_review')
        yield* cancelSubtree('work_root')
        // Resolving the blocker makes the rest of the subtree cancellable.
        yield* transition('work_a', 'running')
        const outcome = yield* cancelSubtree('work_root')
        return { outcome, root: yield* stateOf('work_root') }
      }),
    )
    expect(result.root).toBe('cancelled')
    expect([...result.outcome.cancelled].sort()).toEqual([
      'work_a',
      'work_root',
    ])
  })

  it('emits one work.cancelled event per unit actually cancelled', () => {
    const cancelled = run(
      Effect.gen(function* () {
        yield* tree
        yield* cancelSubtree('work_root')
        const events = yield* EventStore
        const log = yield* events.readAfter(workspaceId, 0)
        return Chunk.toReadonlyArray(log).filter(
          (event) => event.type === 'work.cancelled',
        ).length
      }),
    )
    expect(cancelled).toBe(4)
  })

  it('fails for an unknown work unit', () => {
    expect(failureTag(runExit(cancelSubtree('work_absent')))).toBe(
      'NotFoundError',
    )
  })
})
