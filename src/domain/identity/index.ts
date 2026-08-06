/** @Acp.Domain.Identity — worker provenance */
export {
  canonicalAssertionPayload,
  publicKeyToBase64,
  verifyWorkerAssertion,
} from './worker-assertion.js'
export type {
  AssertionAction,
  AssertionClaims,
  WorkerAssertion,
} from './worker-assertion.js'
export {
  ACP_ASSERTION_HEADER,
  decodeAssertionHeader,
} from './assertion-header.js'
export {
  WorkerIdentityService,
  WorkerIdentityServiceLive,
} from './worker-identity-service.js'
export type {
  IdentityOutcome,
  VerifyIdentityInput,
  WorkerIdentityServiceApi,
} from './worker-identity-service.js'
