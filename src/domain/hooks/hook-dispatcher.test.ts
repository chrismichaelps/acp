/** @Acp.Domain.Hooks.Dispatcher.Test — ordering, short-circuit, timeouts */
import { describe, expect, it } from 'vitest'
import {
  Cause,
  Effect,
  Exit,
  Fiber,
  Option,
  TestClock,
  TestContext,
} from 'effect'
import type { Hook, HookOutcome, HookPayload } from './hook.js'
import { allow, denyAbort, denyContinue } from './hook.js'
import { makeHookDispatcher } from './hook-dispatcher.js'

const point = 'work.before_transition' as const

const payload: HookPayload = {
  point,
  workspaceId: 'workspace_1',
  actor: 'agent_a',
  subjectId: 'work_1',
  detail: { to: 'needs_review' },
}

/** Collects the order hooks ran in, so dispatch order is observable. */
const recorder = () => {
  const seen: string[] = []
  const hook = (name: string, outcome: HookOutcome): Hook => ({
    name,
    point,
    run: () =>
      Effect.as(
        Effect.sync(() => seen.push(name)),
        outcome,
      ),
  })
  return { seen, hook }
}

const dispatch = (hooks: readonly Hook[]) =>
  Effect.runSyncExit(makeHookDispatcher(hooks).dispatch(point, payload))

const failureOf = <A, E>(exit: Exit.Exit<A, E>): E => {
  if (Exit.isSuccess(exit)) throw new Error('expected a failure')
  return Option.getOrThrowWith(
    Cause.failureOption(exit.cause),
    () => new Error('expected a typed failure'),
  )
}

describe('hook dispatcher', () => {
  it('allows the operation when no hooks are registered', () => {
    expect(Exit.isSuccess(dispatch([]))).toBe(true)
  })

  it('runs hooks in declared name order, not registration order', () => {
    const { seen, hook } = recorder()
    const exit = dispatch([
      hook('c', allow),
      hook('a', allow),
      hook('b', allow),
    ])
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(seen).toEqual(['a', 'b', 'c'])
  })

  it('refuses the operation on DenyAbort, naming the hook and reason', () => {
    const { hook } = recorder()
    const error = failureOf(
      dispatch([hook('a', denyAbort('release freeze in effect'))]),
    )
    expect(error._tag).toBe('HookDeniedError')
    expect(error.hookName).toBe('a')
    expect(error.reason).toBe('release freeze in effect')
    expect(error.point).toBe(point)
  })

  it('short-circuits the remaining hooks after DenyAbort', () => {
    const { seen, hook } = recorder()
    dispatch([hook('a', denyAbort('no')), hook('b', allow)])
    expect(seen).toEqual(['a'])
  })

  it('continues past DenyContinue and still allows the operation', () => {
    const { seen, hook } = recorder()
    const exit = dispatch([
      hook('a', denyContinue('advisory only')),
      hook('b', allow),
    ])
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(seen).toEqual(['a', 'b'])
  })

  it('lets a later DenyAbort refuse even after a DenyContinue', () => {
    const { hook } = recorder()
    const error = failureOf(
      dispatch([
        hook('a', denyContinue('advisory')),
        hook('b', denyAbort('blocked')),
      ]),
    )
    expect(error.hookName).toBe('b')
  })

  it('only runs hooks registered for the dispatched point', () => {
    const seen: string[] = []
    const at = (name: string, at: Hook['point']): Hook => ({
      name,
      point: at,
      run: () =>
        Effect.as(
          Effect.sync(() => seen.push(name)),
          allow,
        ),
    })
    Effect.runSyncExit(
      makeHookDispatcher([
        at('transition', point),
        at('lease', 'lease.before_grant'),
      ]).dispatch(point, payload),
    )
    expect(seen).toEqual(['transition'])
  })

  it('fails closed when a hook exceeds its timeout', async () => {
    const hung: Hook = {
      name: 'hung',
      point,
      timeoutMs: 50,
      run: () => Effect.as(Effect.sleep('10 seconds'), allow),
    }
    const exit = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const fiber = yield* Effect.fork(
            Effect.exit(makeHookDispatcher([hung]).dispatch(point, payload)),
          )
          yield* TestClock.adjust('1 minute')
          return yield* Fiber.join(fiber)
        }),
        TestContext.TestContext,
      ),
    )
    const error = failureOf(exit)
    expect(error._tag).toBe('HookDeniedError')
    expect(error.hookName).toBe('hung')
    expect(error.reason).toMatch(/timed out/i)
  })

  it('does not time out a hook that answers within its budget', async () => {
    const prompt: Hook = {
      name: 'prompt',
      point,
      timeoutMs: 5000,
      run: () => Effect.as(Effect.sleep('10 millis'), allow),
    }
    const exit = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const fiber = yield* Effect.fork(
            Effect.exit(makeHookDispatcher([prompt]).dispatch(point, payload)),
          )
          yield* TestClock.adjust('1 second')
          return yield* Fiber.join(fiber)
        }),
        TestContext.TestContext,
      ),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
  })
})
