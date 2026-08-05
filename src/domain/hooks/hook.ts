/** @Acp.Domain.Hooks — pre-mutation gate vocabulary */
import type { Effect } from 'effect'

/**
 * The coordination mutations a hook may refuse. Closed on purpose: the gated
 * surface has to be auditable, and a typo should be a compile error rather than
 * a hook that silently never fires. See [[ADR-0022-coordination-hooks]].
 */
export type HookPoint =
  | 'work.before_claim'
  | 'work.before_transition'
  | 'lease.before_grant'
  | 'review.before_verdict'

/**
 * What a hook observes. Read-only by construction: a hook cannot alter the
 * mutation, only judge it, so hook order can never change the recorded outcome.
 */
export interface HookPayload {
  readonly point: HookPoint
  readonly workspaceId: string
  /** The worker performing the mutation. */
  readonly actor: string
  /** The entity being mutated — work id, lease resource, or review id. */
  readonly subjectId: string
  /**
   * Point-specific context, e.g. the target state of a transition. Values are
   * `string | undefined` because an arbitrary key lookup can miss — the type
   * should not promise a hook that every key it asks for is present.
   */
  readonly detail: Readonly<Record<string, string | undefined>>
}

/**
 * A hook's verdict.
 *
 * `DenyContinue` records an objection without stopping the operation;
 * `DenyAbort` refuses it and skips the remaining hooks. `reason` is required on
 * both at the type level — an agent refused without an explanation retries, and
 * a retrying agent against a deterministic gate is an infinite loop.
 */
export type HookOutcome =
  | { readonly _tag: 'Allow' }
  | { readonly _tag: 'DenyContinue'; readonly reason: string }
  | { readonly _tag: 'DenyAbort'; readonly reason: string }

export const allow: HookOutcome = { _tag: 'Allow' }

export const denyContinue = (reason: string): HookOutcome => ({
  _tag: 'DenyContinue',
  reason,
})

export const denyAbort = (reason: string): HookOutcome => ({
  _tag: 'DenyAbort',
  reason,
})

/** Timeout applied when a hook does not declare its own. */
export const DEFAULT_HOOK_TIMEOUT_MS = 2000

export interface Hook {
  /** Unique; also the dispatch order key, so ordering is explicit not incidental. */
  readonly name: string
  readonly point: HookPoint
  /** Defaults to `DEFAULT_HOOK_TIMEOUT_MS`. Expiry is a refusal, never a pass. */
  readonly timeoutMs?: number
  readonly run: (payload: HookPayload) => Effect.Effect<HookOutcome>
}
