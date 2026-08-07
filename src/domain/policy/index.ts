/** @Acp.Domain.Policy — public surface */
export { evaluatePolicy, loadPolicy, PolicyDocument } from './policy-engine.js'
export type {
  PolicyAction,
  PolicyDecision,
  PolicyOutcome,
  PolicyRequest,
  PolicyRule,
} from './policy-engine.js'
export { policyHooks } from './policy-hook.js'
export type { PolicyOverlays } from './policy-hook.js'
export { evaluateWithOverlay } from './policy-overlay.js'
