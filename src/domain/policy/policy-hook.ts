/** @Acp.Domain.Policy.Hook — policy evaluation as coordination hooks */
import { Effect, Option } from 'effect'
import { allow, denyAbort } from '../hooks/index.js'
import type { Hook, HookPayload } from '../hooks/index.js'
import { evaluateWithOverlay } from './policy-overlay.js'
import type { PolicyAction, PolicyDocument } from './policy-engine.js'

/**
 * Maps a hook payload onto the resource a policy rule reasons about.
 *
 * A lease names its resource directly. A work claim's resource is the work unit
 * itself, which is modelled as kind `task` so one rule vocabulary covers both.
 */
const toRequest = (action: PolicyAction, payload: HookPayload) => ({
  action,
  worker: payload.actor,
  resourceKind:
    action === 'lease.grant' ? (payload.detail.resource_kind ?? '') : 'task',
  resourceUri: payload.subjectId,
})

/** Overlays keyed by workspace id; a workspace without one uses the host policy. */
export type PolicyOverlays = ReadonlyMap<string, PolicyDocument>

const hookFor = (
  action: PolicyAction,
  point: Hook['point'],
  policy: PolicyDocument,
  overlays: PolicyOverlays,
): Hook => ({
  // Prefixed so policy always evaluates before hooks registered later in the
  // alphabet; dispatch order is by name, per [[ADR-0022-coordination-hooks]].
  name: `00-policy.${action}`,
  point,
  run: (payload) =>
    Effect.sync(() => {
      const outcome = evaluateWithOverlay(
        policy,
        Option.fromNullable(overlays.get(payload.workspaceId)),
        toRequest(action, payload),
      )
      if (outcome.decision === 'allow') return allow
      // A refused agent that is not told why will retry; the justification is
      // required on non-allow rules precisely so this message can be useful.
      const because =
        outcome.justification ??
        (outcome.ruleName === undefined
          ? 'no rule matched and the policy default is deny'
          : `rule "${outcome.ruleName}" denies this`)
      return denyAbort(because)
    }),
})

/**
 * Projects a policy document onto the hook points it governs.
 *
 * Policy rides the hook seam rather than introducing a second interception
 * mechanism: it inherits dispatch ordering, the fail-closed timeout, the
 * `acp_hook_outcomes_total` counter, and the 403 mapping, and it demonstrates
 * that the seam from ADR-0022 carries a real consumer.
 *
 * Policy can only narrow. It runs after the session's permission check, so a
 * rule can refuse an action the caller was authorized for, but can never grant
 * one it was not — a policy file is not a privilege-escalation path.
 */
export const policyHooks = (
  policy: PolicyDocument,
  overlays: PolicyOverlays = new Map(),
): readonly Hook[] => [
  hookFor('lease.grant', 'lease.before_grant', policy, overlays),
  hookFor('work.claim', 'work.before_claim', policy, overlays),
]
