/** @Acp.Infra.Http.SpecRouteInventory.TestSupport — spec §12 REST route inventory */

export interface SpecEndpoint {
  readonly group: string
  readonly name: string
  readonly method: string
  readonly path: string
}

/**
 * The v0.1 REST surface from spec section 12, listed explicitly so that adding,
 * renaming, or moving an endpoint is a deliberate edit to a reviewed list
 * rather than an invisible change to generated output.
 */
export const specV1Endpoints: readonly SpecEndpoint[] = [
  {
    group: 'session',
    name: 'initializeSession',
    method: 'POST',
    path: '/v1/session/initialize',
  },
  {
    group: 'workers',
    name: 'listWorkers',
    method: 'GET',
    path: '/v1/workers',
  },
  {
    group: 'workers',
    name: 'getWorker',
    method: 'GET',
    path: '/v1/workers/:worker_id',
  },
  {
    group: 'workspaces',
    name: 'listWorkspaces',
    method: 'GET',
    path: '/v1/workspaces',
  },
  {
    group: 'workspaces',
    name: 'createWorkspace',
    method: 'POST',
    path: '/v1/workspaces',
  },
  {
    group: 'workspaces',
    name: 'updateWorkspace',
    method: 'PATCH',
    path: '/v1/workspaces/:workspace_id',
  },
  {
    group: 'workspaces',
    name: 'archiveWorkspace',
    method: 'POST',
    path: '/v1/workspaces/:workspace_id/archive',
  },
  {
    group: 'workspaces',
    name: 'listWorkspaceWork',
    method: 'GET',
    path: '/v1/workspaces/:workspace_id/work',
  },
  {
    group: 'workspaces',
    name: 'listWorkspaceCheckpoints',
    method: 'GET',
    path: '/v1/workspaces/:workspace_id/checkpoints',
  },
  {
    group: 'workspaces',
    name: 'listWorkspaceArtifacts',
    method: 'GET',
    path: '/v1/workspaces/:workspace_id/artifacts',
  },
  {
    group: 'workspaces',
    name: 'listWorkspaceReviews',
    method: 'GET',
    path: '/v1/workspaces/:workspace_id/reviews',
  },
  { group: 'work', name: 'createWork', method: 'POST', path: '/v1/work' },
  {
    group: 'work',
    name: 'getWork',
    method: 'GET',
    path: '/v1/work/:work_id',
  },
  {
    group: 'work',
    name: 'claimWork',
    method: 'POST',
    path: '/v1/work/:work_id/claim',
  },
  {
    group: 'work',
    name: 'updateWorkState',
    method: 'PATCH',
    path: '/v1/work/:work_id',
  },
  {
    group: 'work',
    name: 'publishWorkEvent',
    method: 'POST',
    path: '/v1/work/:work_id/events',
  },
  {
    group: 'work',
    name: 'listWorkChildren',
    method: 'GET',
    path: '/v1/work/:work_id/children',
  },
  {
    group: 'work',
    name: 'listWorkDescendants',
    method: 'GET',
    path: '/v1/work/:work_id/descendants',
  },
  {
    group: 'work',
    name: 'listWorkCheckpoints',
    method: 'GET',
    path: '/v1/work/:work_id/checkpoints',
  },
  {
    group: 'work',
    name: 'latestWorkCheckpoint',
    method: 'GET',
    path: '/v1/work/:work_id/checkpoints/latest',
  },
  {
    group: 'work',
    name: 'listWorkArtifacts',
    method: 'GET',
    path: '/v1/work/:work_id/artifacts',
  },
  {
    group: 'work',
    name: 'listWorkReviews',
    method: 'GET',
    path: '/v1/work/:work_id/reviews',
  },
  {
    group: 'leases',
    name: 'listLeases',
    method: 'GET',
    path: '/v1/leases',
  },
  {
    group: 'leases',
    name: 'requestLease',
    method: 'POST',
    path: '/v1/leases',
  },
  {
    group: 'leases',
    name: 'renewLease',
    method: 'POST',
    path: '/v1/leases/:lease_id/renew',
  },
  {
    group: 'leases',
    name: 'releaseLease',
    method: 'POST',
    path: '/v1/leases/:lease_id/release',
  },
  {
    group: 'leases',
    name: 'revokeLease',
    method: 'POST',
    path: '/v1/leases/:lease_id/revoke',
  },
  {
    group: 'artifacts',
    name: 'createArtifact',
    method: 'POST',
    path: '/v1/artifacts',
  },
  {
    group: 'artifacts',
    name: 'updateArtifact',
    method: 'PATCH',
    path: '/v1/artifacts/:artifact_id',
  },
  {
    group: 'artifacts',
    name: 'deleteArtifact',
    method: 'DELETE',
    path: '/v1/artifacts/:artifact_id',
  },
  {
    group: 'artifacts',
    name: 'getArtifactContent',
    method: 'GET',
    path: '/v1/artifacts/:artifact_id/content',
  },
  {
    group: 'checkpoints',
    name: 'createCheckpoint',
    method: 'POST',
    path: '/v1/checkpoints',
  },
  {
    group: 'memory',
    name: 'createMemory',
    method: 'POST',
    path: '/v1/memory',
  },
  {
    group: 'memory',
    name: 'listMemory',
    method: 'GET',
    path: '/v1/memory',
  },
  {
    group: 'resume',
    name: 'getWorkResumePacket',
    method: 'GET',
    path: '/v1/work/:work_id/resume',
  },
  {
    group: 'reviews',
    name: 'requestReview',
    method: 'POST',
    path: '/v1/reviews',
  },
  {
    group: 'reviews',
    name: 'approveReview',
    method: 'POST',
    path: '/v1/reviews/:review_id/approve',
  },
  {
    group: 'reviews',
    name: 'rejectReview',
    method: 'POST',
    path: '/v1/reviews/:review_id/reject',
  },
  {
    group: 'reviews',
    name: 'requestReviewChanges',
    method: 'POST',
    path: '/v1/reviews/:review_id/request_changes',
  },
  {
    group: 'reviews',
    name: 'cancelReview',
    method: 'POST',
    path: '/v1/reviews/:review_id/cancel',
  },
  {
    group: 'reviewComments',
    name: 'addReviewComment',
    method: 'POST',
    path: '/v1/reviews/:review_id/comments',
  },
  {
    group: 'reviewComments',
    name: 'listReviewComments',
    method: 'GET',
    path: '/v1/reviews/:review_id/comments',
  },
  {
    group: 'reviewComments',
    name: 'resolveReviewComment',
    method: 'POST',
    path: '/v1/review-comments/:comment_id/resolve',
  },
  {
    group: 'reviewComments',
    name: 'reopenReviewComment',
    method: 'POST',
    path: '/v1/review-comments/:comment_id/reopen',
  },
  {
    group: 'reviewComments',
    name: 'setReviewCommentExternalId',
    method: 'POST',
    path: '/v1/review-comments/:comment_id/external-id',
  },
  {
    group: 'reviewComments',
    name: 'listWorkReviewComments',
    method: 'GET',
    path: '/v1/work/:work_id/review-comments',
  },
  {
    group: 'grills',
    name: 'openGrill',
    method: 'POST',
    path: '/v1/reviews/:review_id/grill',
  },
  {
    group: 'grills',
    name: 'listReviewGrills',
    method: 'GET',
    path: '/v1/reviews/:review_id/grills',
  },
  {
    group: 'grills',
    name: 'addGrillQuestion',
    method: 'POST',
    path: '/v1/grills/:grill_id/questions',
  },
  {
    group: 'grills',
    name: 'evaluateGrill',
    method: 'POST',
    path: '/v1/grills/:grill_id/evaluate',
  },
  {
    group: 'grills',
    name: 'getGrill',
    method: 'GET',
    path: '/v1/grills/:grill_id',
  },
  {
    group: 'grills',
    name: 'answerGrillQuestion',
    method: 'POST',
    path: '/v1/grill-questions/:question_id/answer',
  },
  {
    group: 'grills',
    name: 'setGrillVerdict',
    method: 'POST',
    path: '/v1/grill-questions/:question_id/verdict',
  },
  {
    group: 'events',
    name: 'replayEvents',
    method: 'GET',
    path: '/v1/events',
  },
  {
    group: 'events',
    name: 'streamEvents',
    method: 'GET',
    path: '/v1/events/stream',
  },
]
