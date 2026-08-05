/** @Acp.App.PolicyLayer.Test — a policy file gates real coordination */
import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Exit, Layer, Option } from 'effect'
import { AppConfigTag } from '../config/app-config.js'
import { testAppConfig } from '../config/app-config-test-support.js'
import { HookDispatcher } from '../domain/hooks/index.js'
import type { HookPayload } from '../domain/hooks/index.js'
import { PolicyHooksLive } from './policy-layer.js'

const writePolicy = (document: unknown): string => {
  const dir = mkdtempSync(join(tmpdir(), 'acp-policy-'))
  const path = join(dir, 'policy.json')
  writeFileSync(path, JSON.stringify(document), 'utf8')
  return path
}

const dispatcherFor = (policyFile: Option.Option<string>) =>
  Layer.provide(
    PolicyHooksLive,
    Layer.succeed(AppConfigTag, testAppConfig({ policyFile })),
  )

const leasePayload: HookPayload = {
  point: 'lease.before_grant',
  workspaceId: 'workspace_1',
  actor: 'agent_a',
  subjectId: 'file:///src/app.ts',
  detail: { resource_kind: 'file' },
}

const dispatch = (policyFile: Option.Option<string>) =>
  Effect.runSyncExit(
    Effect.provide(
      Effect.flatMap(HookDispatcher, (hooks) =>
        hooks.dispatch('lease.before_grant', leasePayload),
      ),
      dispatcherFor(policyFile),
    ),
  )

const validPolicy = {
  default: 'allow',
  rules: [
    {
      name: 'freeze-src',
      action: 'lease.grant',
      resource: { uri: 'file:///src/**' },
      decision: 'deny',
      justification: 'src is release-frozen',
      match: [
        {
          action: 'lease.grant',
          worker: 'agent_a',
          resourceKind: 'file',
          resourceUri: 'file:///src/app.ts',
        },
      ],
    },
  ],
}

describe('policy layer', () => {
  it('leaves coordination unchanged when no policy file is configured', () => {
    expect(Exit.isSuccess(dispatch(Option.none()))).toBe(true)
  })

  it('refuses a lease the configured policy denies', () => {
    const exit = dispatch(Option.some(writePolicy(validPolicy)))
    expect(Exit.isSuccess(exit)).toBe(false)
  })

  it('allows a lease the configured policy does not cover', () => {
    const exit = Effect.runSyncExit(
      Effect.provide(
        Effect.flatMap(HookDispatcher, (hooks) =>
          hooks.dispatch('lease.before_grant', {
            ...leasePayload,
            subjectId: 'file:///docs/readme.md',
          }),
        ),
        dispatcherFor(Option.some(writePolicy(validPolicy))),
      ),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
  })

  it('aborts startup when the policy fails its own match example', () => {
    const path = writePolicy({
      default: 'allow',
      rules: [
        {
          ...validPolicy.rules[0],
          resource: { uri: 'file:///lib/**' },
        },
      ],
    })
    // A failing self-test is a defect, not a recoverable error: the host must
    // not come up serving a rule that no longer means what it says.
    const exit = dispatch(Option.some(path))
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it('aborts startup when the policy file is absent from disk', () => {
    const exit = dispatch(Option.some('/nonexistent/acp-policy.json'))
    expect(Exit.isFailure(exit)).toBe(true)
  })
})
