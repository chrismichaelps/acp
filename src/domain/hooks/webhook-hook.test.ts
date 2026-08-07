/** @Acp.Domain.Hooks.Webhook.Test — remote verdicts, decoded conservatively */
import { describe, expect, it } from 'vitest'
import { Effect, Either } from 'effect'
import type { HookOutcome, HookPayload } from './hook.js'
import {
  decodeWebhookResponse,
  loadWebhookHooks,
  makeWebhookHook,
} from './webhook-hook.js'

const payload: HookPayload = {
  point: 'lease.before_grant',
  workspaceId: 'workspace_1',
  actor: 'agent_a',
  subjectId: 'file:///src/app.ts',
  detail: { resource_kind: 'file' },
}

/** `reason` exists only on the denial variants, so narrow before reading it. */
const reasonOf = (outcome: HookOutcome): string =>
  outcome._tag === 'Allow' ? '' : outcome.reason

const decl = {
  name: 'release-freeze',
  point: 'lease.before_grant',
  url: 'https://policy.internal/hooks/freeze',
}

describe('webhook response decoding', () => {
  it('accepts an allow verdict', () => {
    const result = decodeWebhookResponse({ decision: 'allow' })
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) expect(result.right._tag).toBe('Allow')
  })

  it.each(['deny_continue', 'deny_abort'])(
    'accepts a %s verdict carrying a reason',
    (decision) => {
      const result = decodeWebhookResponse({ decision, reason: 'frozen' })
      expect(Either.isRight(result)).toBe(true)
      if (Either.isRight(result)) expect(reasonOf(result.right)).toBe('frozen')
    },
  )

  // A denial without a reason is the one shape the local Hook type makes
  // unconstructable, so the wire has to enforce what the type cannot.
  it.each(['deny_continue', 'deny_abort'])(
    'rejects %s with no reason',
    (decision) => {
      expect(Either.isLeft(decodeWebhookResponse({ decision }))).toBe(true)
    },
  )

  it.each<unknown>([{ decision: 'maybe' }, {}, null, 'allow'])(
    'rejects a malformed response (%s)',
    (body) => {
      expect(Either.isLeft(decodeWebhookResponse(body))).toBe(true)
    },
  )

  // Deliberately tolerant of extra fields. Rejecting them would turn a benign
  // `{ decision: 'allow', requestId: '…' }` into a fail-closed DenyAbort, so
  // strictness here would brick coordination over harmless metadata. The
  // strictness that matters — a denial must carry a reason — is enforced above.
  it('ignores unrecognised fields alongside a valid decision', () => {
    const result = decodeWebhookResponse({
      decision: 'allow',
      requestId: 'abc123',
    })
    expect(Either.isRight(result)).toBe(true)
  })
})

describe('webhook hook dispatch', () => {
  const hookWith = (
    respond: () => Effect.Effect<unknown, Error>,
    over: Record<string, unknown> = {},
  ) => makeWebhookHook({ ...decl, ...over } as never, respond)

  it('allows when the endpoint allows', () => {
    const outcome = Effect.runSync(
      hookWith(() => Effect.succeed({ decision: 'allow' })).run(payload),
    )
    expect(outcome._tag).toBe('Allow')
  })

  it('refuses when the endpoint aborts, carrying its reason', () => {
    const outcome = Effect.runSync(
      hookWith(() =>
        Effect.succeed({ decision: 'deny_abort', reason: 'release freeze' }),
      ).run(payload),
    )
    expect(outcome._tag).toBe('DenyAbort')
    expect(reasonOf(outcome)).toBe('release freeze')
  })

  // Every failure mode below is a refusal, not a pass. An endpoint that is
  // down, slow, or talking nonsense cannot be distinguished from one that
  // would have denied, so the gate must not silently disappear.
  it('refuses when the endpoint is unreachable', () => {
    const outcome = Effect.runSync(
      hookWith(() => Effect.fail(new Error('ECONNREFUSED'))).run(payload),
    )
    expect(outcome._tag).toBe('DenyAbort')
    expect(reasonOf(outcome)).toMatch(/unreachable|ECONNREFUSED/i)
  })

  it('refuses when the endpoint returns an undecodable body', () => {
    const outcome = Effect.runSync(
      hookWith(() => Effect.succeed({ decision: 'lgtm' })).run(payload),
    )
    expect(outcome._tag).toBe('DenyAbort')
  })

  it('names the hook in every refusal so a wedged endpoint is identifiable', () => {
    const outcome = Effect.runSync(
      hookWith(() => Effect.fail(new Error('boom'))).run(payload),
    )
    expect(reasonOf(outcome)).toContain('release-freeze')
  })

  it('carries the declared point and timeout onto the hook', () => {
    const hook = hookWith(() => Effect.succeed({ decision: 'allow' }), {
      timeoutMs: 500,
    })
    expect(hook.point).toBe('lease.before_grant')
    expect(hook.timeoutMs).toBe(500)
    expect(hook.name).toBe('release-freeze')
  })
})

describe('webhook hook loading', () => {
  it('loads a well-formed declaration', () => {
    expect(Either.isRight(loadWebhookHooks({ hooks: [decl] }))).toBe(true)
  })

  it('accepts an empty hook list', () => {
    expect(Either.isRight(loadWebhookHooks({ hooks: [] }))).toBe(true)
  })

  it('refuses a duplicate hook name', () => {
    expect(Either.isLeft(loadWebhookHooks({ hooks: [decl, decl] }))).toBe(true)
  })

  it('refuses an unknown hook point rather than never firing', () => {
    const result = loadWebhookHooks({
      hooks: [{ ...decl, point: 'work.before_delete' }],
    })
    expect(Either.isLeft(result)).toBe(true)
  })

  // A plaintext endpoint would carry coordination details, and any hop could
  // forge a verdict the host treats as authoritative.
  it.each(['http://policy.internal/h', 'ftp://x/y', 'notaurl'])(
    'refuses a non-https url (%s)',
    (url) => {
      expect(
        Either.isLeft(loadWebhookHooks({ hooks: [{ ...decl, url }] })),
      ).toBe(true)
    },
  )

  it('allows https on localhost for development', () => {
    const result = loadWebhookHooks({
      hooks: [{ ...decl, url: 'https://localhost:8443/hooks' }],
    })
    expect(Either.isRight(result)).toBe(true)
  })
})
