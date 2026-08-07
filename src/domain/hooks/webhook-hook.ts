/** @Acp.Domain.Hooks.Webhook — operator-configured remote gates */
import { Effect, Either, Schema } from 'effect'
import { ValidationError } from '../../protocol/errors/protocol-error.js'
import { allow, denyAbort, denyContinue } from './hook.js'
import type { Hook, HookOutcome, HookPayload } from './hook.js'

const HookPointSchema = Schema.Literal(
  'work.before_claim',
  'work.before_transition',
  'lease.before_grant',
  'review.before_verdict',
)

/**
 * The verdict shape an endpoint must return.
 *
 * `deny_*` requires a reason, because the local `Hook` type makes an
 * unreasoned denial unconstructable and the wire has to enforce what the type
 * cannot — a typo'd `reasson` therefore fails to decode rather than producing
 * an unexplained denial.
 *
 * Extra fields are tolerated. Rejecting them would turn a benign
 * `{ decision: 'allow', requestId: '…' }` into a fail-closed refusal, which
 * would brick coordination over harmless metadata.
 */
const WebhookResponse = Schema.Union(
  Schema.Struct({ decision: Schema.Literal('allow') }),
  Schema.Struct({
    decision: Schema.Literal('deny_continue', 'deny_abort'),
    reason: Schema.NonEmptyString,
  }),
)

export const decodeWebhookResponse = (
  body: unknown,
): Either.Either<HookOutcome, ValidationError> =>
  Either.match(Schema.decodeUnknownEither(WebhookResponse)(body), {
    onLeft: (error) =>
      Either.left(new ValidationError({ issues: [String(error)] })),
    onRight: (response) =>
      Either.right(
        response.decision === 'allow'
          ? allow
          : response.decision === 'deny_continue'
            ? denyContinue(response.reason)
            : denyAbort(response.reason),
      ),
  })

const WebhookHookDeclaration = Schema.Struct({
  name: Schema.NonEmptyString,
  point: HookPointSchema,
  /**
   * HTTPS only. A plaintext endpoint would carry coordination details in the
   * clear, and any hop could forge a verdict the host treats as authoritative.
   */
  url: Schema.NonEmptyString.pipe(
    Schema.filter((url) => url.startsWith('https://'), {
      message: () => 'webhook url must be https',
    }),
  ),
  timeoutMs: Schema.optional(Schema.Int.pipe(Schema.positive())),
})
export type WebhookHookDeclaration = typeof WebhookHookDeclaration.Type

const WebhookHooksDocument = Schema.Struct({
  hooks: Schema.Array(WebhookHookDeclaration),
})
export type WebhookHooksDocument = typeof WebhookHooksDocument.Type

/**
 * Decodes and validates a webhook hook document.
 *
 * Duplicate names are refused because the name is the dispatch order key —
 * two hooks sharing one would make ordering ambiguous, which is the property
 * [[ADR-0022-coordination-hooks]] relies on for reproducible refusals.
 */
export const loadWebhookHooks = (
  document: unknown,
): Either.Either<WebhookHooksDocument, ValidationError> => {
  const decoded = Schema.decodeUnknownEither(WebhookHooksDocument)(document)
  if (Either.isLeft(decoded)) {
    return Either.left(new ValidationError({ issues: [String(decoded.left)] }))
  }
  const seen = new Set<string>()
  const issues: string[] = []
  for (const hook of decoded.right.hooks) {
    if (seen.has(hook.name)) issues.push(`duplicate hook name "${hook.name}"`)
    seen.add(hook.name)
  }
  return issues.length === 0
    ? Either.right(decoded.right)
    : Either.left(new ValidationError({ issues }))
}

/** Posts a payload to an endpoint and returns its parsed body. */
export type WebhookTransport = (
  url: string,
  payload: HookPayload,
) => Effect.Effect<unknown, Error>

/**
 * Adapts a declaration into a `Hook`.
 *
 * Every failure mode is a refusal, never a pass: an endpoint that is down,
 * slow, or talking nonsense cannot be told apart from one that would have
 * denied, so the gate must not silently disappear when it breaks. The dispatch
 * timeout in [[ADR-0022-coordination-hooks]] bounds the latency this adds, and
 * expiry is already a `DenyAbort` there.
 */
export const makeWebhookHook = (
  declaration: WebhookHookDeclaration,
  transport: (payload: HookPayload) => Effect.Effect<unknown, Error>,
): Hook => ({
  name: declaration.name,
  point: declaration.point,
  ...(declaration.timeoutMs === undefined
    ? {}
    : { timeoutMs: declaration.timeoutMs }),
  run: (payload) =>
    transport(payload).pipe(
      Effect.map((body) =>
        Either.match(decodeWebhookResponse(body), {
          onLeft: (error) =>
            denyAbort(
              `hook "${declaration.name}" returned an undecodable verdict: ${error.issues.join('; ')}`,
            ),
          onRight: (outcome) => outcome,
        }),
      ),
      Effect.catchAll((cause) =>
        Effect.succeed(
          denyAbort(
            `hook "${declaration.name}" endpoint unreachable: ${cause.message}`,
          ),
        ),
      ),
    ),
})
