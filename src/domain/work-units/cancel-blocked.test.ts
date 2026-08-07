/** @Acp.Domain.WorkUnits.CancelBlocked.Test — blocked work is abandonable */
import { describe, expect, it } from 'vitest'
import { Effect, Option } from 'effect'
import { WorkUnitService } from './index.js'
import {
  create,
  id,
  now,
  run,
  toRunning,
  transition,
  workerId,
} from './work-unit-spawn-graph-test-support.js'

const stateOf = (raw: string) =>
  Effect.flatMap(WorkUnitService, (svc) =>
    Effect.map(svc.get(id(raw)), (found) => Option.getOrThrow(found).state),
  )

const toBlocked = (raw: string) =>
  Effect.gen(function* () {
    yield* create(raw)
    yield* toRunning(raw)
    yield* transition(raw, 'blocked')
  })

describe('cancelling blocked work', () => {
  it('cancels a blocked unit directly', () => {
    // Previously impossible: the only edge out of `blocked` was `running`, so
    // abandoning externally-stalled work meant pretending it had resumed.
    const state = run(
      Effect.gen(function* () {
        yield* toBlocked('work_stalled')
        yield* transition('work_stalled', 'cancelled')
        return yield* stateOf('work_stalled')
      }),
    )
    expect(state).toBe('cancelled')
  })

  it('still allows a blocked unit to resume', () => {
    const state = run(
      Effect.gen(function* () {
        yield* toBlocked('work_stalled')
        yield* transition('work_stalled', 'running')
        return yield* stateOf('work_stalled')
      }),
    )
    expect(state).toBe('running')
  })

  it('cancels a blocked descendant as part of a subtree cascade', () => {
    const result = run(
      Effect.gen(function* () {
        const svc = yield* WorkUnitService
        yield* create('work_root')
        yield* toRunning('work_root')
        yield* create('work_child', id('work_root'))
        yield* toRunning('work_child')
        yield* transition('work_child', 'blocked')
        const outcome = yield* svc.cancelSubtree(id('work_root'), workerId, now)
        return {
          outcome,
          child: yield* stateOf('work_child'),
          root: yield* stateOf('work_root'),
        }
      }),
    )
    // The cascade no longer stalls on externally-blocked descendants.
    expect(result.outcome.blocked).toEqual([])
    expect(result.child).toBe('cancelled')
    expect(result.root).toBe('cancelled')
  })

  it('leaves terminal states terminal', () => {
    const state = run(
      Effect.gen(function* () {
        yield* toBlocked('work_stalled')
        yield* transition('work_stalled', 'cancelled')
        return yield* stateOf('work_stalled')
      }),
    )
    expect(state).toBe('cancelled')
  })
})
