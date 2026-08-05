/** @Acp.Domain.Policy.Hook.Test — policy refusals through the hook seam */
import { describe, expect, it } from 'vitest'
import { Cause, Effect, Exit, Option } from 'effect'
import { makeHookDispatcher } from '../hooks/index.js'
import type { HookPayload } from '../hooks/index.js'
import { loadPolicy } from './policy-engine.js'
import { policyHooks } from './policy-hook.js'

const policy = (rules: readonly unknown[], fallback = 'allow') => {
  const result = loadPolicy({ default: fallback, rules })
  if (result._tag === 'Left') {
    throw new Error(`policy failed to load: ${result.left.issues.join('; ')}`)
  }
  return result.right
}

const leasePayload = (uri: string, actor = 'agent_a'): HookPayload => ({
  point: 'lease.before_grant',
  workspaceId: 'workspace_1',
  actor,
  subjectId: uri,
  detail: { resource_kind: 'file' },
})

const claimPayload = (workId: string, actor = 'agent_a'): HookPayload => ({
  point: 'work.before_claim',
  workspaceId: 'workspace_1',
  actor,
  subjectId: workId,
  detail: { from: 'open' },
})

const dispatch = (
  rules: readonly unknown[],
  payload: HookPayload,
  fallback = 'allow',
) =>
  Effect.runSyncExit(
    makeHookDispatcher(policyHooks(policy(rules, fallback))).dispatch(
      payload.point,
      payload,
    ),
  )

const reasonOf = <A, E>(exit: Exit.Exit<A, E>): string => {
  if (Exit.isSuccess(exit)) return ''
  return Option.match(Cause.failureOption(exit.cause), {
    onNone: () => '',
    onSome: (error) => (error as { reason?: string }).reason ?? '',
  })
}

const denyFrozenSrc = {
  name: 'freeze-src',
  action: 'lease.grant',
  resource: { uri: 'file:///src/**' },
  decision: 'deny',
  justification: 'src is release-frozen; open a work unit instead',
}

describe('policy as a hook', () => {
  it('allows a lease the policy does not cover', () => {
    const exit = dispatch([denyFrozenSrc], leasePayload('file:///docs/a.md'))
    expect(Exit.isSuccess(exit)).toBe(true)
  })

  it('refuses a lease a rule denies, surfacing the justification', () => {
    const exit = dispatch([denyFrozenSrc], leasePayload('file:///src/app.ts'))
    expect(Exit.isSuccess(exit)).toBe(false)
    expect(reasonOf(exit)).toBe(
      'src is release-frozen; open a work unit instead',
    )
  })

  it('scopes a denial to the named worker', () => {
    const rules = [{ ...denyFrozenSrc, worker: 'agent_ci' }]
    expect(
      Exit.isSuccess(
        dispatch(rules, leasePayload('file:///src/a.ts', 'agent_a')),
      ),
    ).toBe(true)
    expect(
      Exit.isSuccess(
        dispatch(rules, leasePayload('file:///src/a.ts', 'agent_ci')),
      ),
    ).toBe(false)
  })

  it('governs work claims as task resources', () => {
    const rules = [
      {
        name: 'no-claiming-migrations',
        action: 'work.claim',
        resource: { kind: 'task', uri: 'work_migration_**' },
        decision: 'deny',
        justification: 'migrations are claimed by the release worker only',
      },
    ]
    expect(
      Exit.isSuccess(dispatch(rules, claimPayload('work_migration_001'))),
    ).toBe(false)
    expect(Exit.isSuccess(dispatch(rules, claimPayload('work_other')))).toBe(
      true,
    )
  })

  it('refuses everything uncovered when the default is deny', () => {
    const exit = dispatch([], leasePayload('file:///anything'), 'deny')
    expect(Exit.isSuccess(exit)).toBe(false)
    expect(reasonOf(exit)).toMatch(/default is deny/)
  })

  it('does not fire a lease rule at the claim point', () => {
    const exit = dispatch([denyFrozenSrc], claimPayload('file:///src/app.ts'))
    expect(Exit.isSuccess(exit)).toBe(true)
  })
})
