/** @Acp.Domain.Policy.Overlay — per-workspace narrowing over the host policy */
import { Option } from 'effect'
import { evaluatePolicy } from './policy-engine.js'
import type {
  PolicyDocument,
  PolicyOutcome,
  PolicyRequest,
} from './policy-engine.js'

/**
 * Evaluates a request against the host policy and an optional workspace
 * overlay, taking the **more restrictive** of the two.
 *
 * This is what makes an overlay safe to hand to a workspace owner: it can add
 * denials the host did not have, but it can never turn a host denial into an
 * allow. Without that property an overlay file would be a
 * privilege-escalation path — see [[ADR-0023-resource-access-policy]].
 *
 * When both refuse, the overlay is named. An operator debugging a refusal
 * needs to know which file to edit, and the workspace-local one is the likelier
 * answer and the cheaper to change.
 */
export const evaluateWithOverlay = (
  host: PolicyDocument,
  overlay: Option.Option<PolicyDocument>,
  request: PolicyRequest,
): PolicyOutcome => {
  const hostOutcome = evaluatePolicy(host, request)
  return Option.match(overlay, {
    onNone: () => hostOutcome,
    onSome: (document) => {
      const overlayOutcome = evaluatePolicy(document, request)
      if (overlayOutcome.decision !== 'allow') return overlayOutcome
      return hostOutcome
    },
  })
}
