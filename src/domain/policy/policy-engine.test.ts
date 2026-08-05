/** @Acp.Domain.Policy.Engine.Test — evaluation, ordering, load-time self-tests */
import { describe, expect, it } from 'vitest'
import { Either } from 'effect'
import { evaluatePolicy, loadPolicy } from './policy-engine.js'
import type { PolicyRequest } from './policy-engine.js'

const req = (over: Partial<PolicyRequest> = {}): PolicyRequest => ({
  action: 'lease.grant',
  worker: 'agent_a',
  resourceKind: 'file',
  resourceUri: 'file:///src/app.ts',
  ...over,
})

const load = (doc: unknown) => loadPolicy(doc)

const loaded = (doc: unknown) => {
  const result = load(doc)
  if (Either.isLeft(result)) {
    throw new Error(
      `expected the policy to load: ${result.left.issues[0] ?? ''}`,
    )
  }
  return result.right
}

const rule = (over: Record<string, unknown> = {}) => ({
  name: 'r',
  action: 'lease.grant',
  resource: { uri: 'file:///src/**' },
  decision: 'deny',
  justification: 'src is frozen',
  ...over,
})

describe('policy evaluation', () => {
  it('falls back to the declared default when no rule matches', () => {
    const policy = loaded({ default: 'deny', rules: [] })
    expect(evaluatePolicy(policy, req()).decision).toBe('deny')
  })

  it('matches a rule and returns its decision and justification', () => {
    const policy = loaded({ default: 'allow', rules: [rule()] })
    const outcome = evaluatePolicy(policy, req())
    expect(outcome.decision).toBe('deny')
    expect(outcome.justification).toBe('src is frozen')
    expect(outcome.ruleName).toBe('r')
  })

  it('applies first-match-wins over rule order', () => {
    const policy = loaded({
      default: 'deny',
      rules: [
        rule({ name: 'first', decision: 'allow', justification: undefined }),
        rule({ name: 'second', decision: 'deny' }),
      ],
    })
    expect(evaluatePolicy(policy, req()).ruleName).toBe('first')
  })

  it('does not match a rule for a different action', () => {
    const policy = loaded({
      default: 'allow',
      rules: [rule({ action: 'work.claim' })],
    })
    expect(evaluatePolicy(policy, req()).decision).toBe('allow')
  })

  it('scopes a rule to a worker when one is named', () => {
    const policy = loaded({
      default: 'allow',
      rules: [rule({ worker: 'agent_ci' })],
    })
    expect(evaluatePolicy(policy, req({ worker: 'agent_a' })).decision).toBe(
      'allow',
    )
    expect(evaluatePolicy(policy, req({ worker: 'agent_ci' })).decision).toBe(
      'deny',
    )
  })

  it('scopes a rule to a resource kind when one is named', () => {
    const policy = loaded({
      default: 'allow',
      rules: [rule({ resource: { kind: 'branch', uri: '**' } })],
    })
    expect(evaluatePolicy(policy, req({ resourceKind: 'file' })).decision).toBe(
      'allow',
    )
    expect(
      evaluatePolicy(policy, req({ resourceKind: 'branch' })).decision,
    ).toBe('deny')
  })

  it('matches a trailing ** as a prefix wildcard', () => {
    const policy = loaded({ default: 'allow', rules: [rule()] })
    expect(
      evaluatePolicy(policy, req({ resourceUri: 'file:///src/deep/a.ts' }))
        .decision,
    ).toBe('deny')
    expect(
      evaluatePolicy(policy, req({ resourceUri: 'file:///docs/a.md' }))
        .decision,
    ).toBe('allow')
  })

  it('matches an exact uri with no wildcard', () => {
    const policy = loaded({
      default: 'allow',
      rules: [rule({ resource: { uri: 'file:///src/app.ts' } })],
    })
    expect(evaluatePolicy(policy, req()).decision).toBe('deny')
    expect(
      evaluatePolicy(policy, req({ resourceUri: 'file:///src/app.ts.bak' }))
        .decision,
    ).toBe('allow')
  })
})

describe('policy loading', () => {
  it('refuses a document with no explicit default', () => {
    expect(Either.isLeft(load({ rules: [] }))).toBe(true)
  })

  it('refuses a deny rule with no justification', () => {
    const result = load({
      default: 'allow',
      rules: [rule({ justification: undefined })],
    })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('accepts an allow rule with no justification', () => {
    expect(
      Either.isRight(
        load({
          default: 'deny',
          rules: [rule({ decision: 'allow', justification: undefined })],
        }),
      ),
    ).toBe(true)
  })

  it('refuses a rule using the reserved require_review decision', () => {
    const result = load({
      default: 'allow',
      rules: [
        rule({ decision: 'require_review', justification: 'needs a human' }),
      ],
    })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('refuses duplicate rule names', () => {
    expect(
      Either.isLeft(load({ default: 'allow', rules: [rule(), rule()] })),
    ).toBe(true)
  })
})

describe('policy self-tests at load', () => {
  it('accepts a rule whose match example resolves to it', () => {
    expect(
      Either.isRight(
        load({
          default: 'allow',
          rules: [
            rule({
              match: [
                {
                  action: 'lease.grant',
                  worker: 'agent_a',
                  resourceKind: 'file',
                  resourceUri: 'file:///src/app.ts',
                },
              ],
            }),
          ],
        }),
      ),
    ).toBe(true)
  })

  it('refuses a rule whose match example does not resolve to it', () => {
    const result = load({
      default: 'allow',
      rules: [
        rule({
          match: [
            {
              action: 'lease.grant',
              worker: 'agent_a',
              resourceKind: 'file',
              resourceUri: 'file:///docs/readme.md',
            },
          ],
        }),
      ],
    })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('refuses a rule whose notMatch example does resolve to it', () => {
    const result = load({
      default: 'allow',
      rules: [
        rule({
          notMatch: [
            {
              action: 'lease.grant',
              worker: 'agent_a',
              resourceKind: 'file',
              resourceUri: 'file:///src/app.ts',
            },
          ],
        }),
      ],
    })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('refuses when an earlier rule shadows a later rule match example', () => {
    // The example resolves to `shadow`, not to the rule that declared it —
    // exactly the drift that silently disables an access rule.
    const result = load({
      default: 'allow',
      rules: [
        rule({ name: 'shadow', decision: 'allow', justification: undefined }),
        rule({
          name: 'shadowed',
          match: [
            {
              action: 'lease.grant',
              worker: 'agent_a',
              resourceKind: 'file',
              resourceUri: 'file:///src/app.ts',
            },
          ],
        }),
      ],
    })
    expect(Either.isLeft(result)).toBe(true)
  })
})
