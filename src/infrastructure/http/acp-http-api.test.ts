/** @Acp.Infra.Http.Api.Test — reflected route contract */
import { describe, expect, it } from 'vitest'
import { HttpApi } from '@effect/platform'
import { Option, Schema } from 'effect'
import {
  AcpHttpApi,
  InitializeSessionPayload,
  InitializeSessionResponse,
  PublishWorkEventPayload,
} from './index.js'
import {
  extractProductionV1RouteKeys,
  productionV1RouteKeys,
  routeKey,
} from './production-route-inventory-test-support.js'

interface ReflectedEndpoint {
  readonly group: string
  readonly name: string
  readonly method: string
  readonly path: string
}

const reflectEndpoints = (): readonly ReflectedEndpoint[] => {
  const endpoints: ReflectedEndpoint[] = []
  HttpApi.reflect(AcpHttpApi, {
    onGroup: () => undefined,
    onEndpoint: ({ group, endpoint }) => {
      endpoints.push({
        group: group.identifier,
        name: endpoint.name,
        method: endpoint.method,
        path: endpoint.path,
      })
    },
  })
  return endpoints
}

describe('AcpHttpApi', () => {
  it('shares review role validation across session request and response', () => {
    const worker = {
      id: 'agent_reviewer',
      name: 'Reviewer',
      kind: 'agent',
    }
    const dual = ['review:respond', 'review:collaborate']

    expect(() =>
      Schema.decodeUnknownSync(InitializeSessionPayload)({
        worker,
        permissions: dual,
      }),
    ).toThrow(/review:respond and review:collaborate are mutually exclusive/)
    expect(() =>
      Schema.decodeUnknownSync(InitializeSessionResponse)({
        session_id: 'session_dual',
        permissions: dual,
        protocol_version: '0.1',
        host: { name: 'ACP Local', kind: 'local' },
        capabilities: {
          supports_events: true,
          supports_reviews: true,
          supports_signed_review_approvals: true,
          supports_artifacts: true,
          supports_memory: true,
          supports_sse: true,
        },
      }),
    ).toThrow(/review:respond and review:collaborate are mutually exclusive/)
  })

  it('accepts the spec capability-negotiation request body', () => {
    const payload = Schema.decodeUnknownSync(InitializeSessionPayload)({
      protocol_version: '0.1',
      worker: {
        id: 'agent_openhands',
        name: 'OpenHands',
        kind: 'agent',
        vendor: 'openhands',
      },
      capabilities: {
        can_edit_files: true,
        can_run_commands: true,
        can_create_prs: false,
        can_review: true,
        supports_checkpoints: true,
        supports_leases: true,
      },
      permissions: ['work:create'],
    })

    expect(payload.worker.status).toBe('online')
    expect(payload.worker.capabilities).toEqual([])
    expect(payload.capabilities.can_review).toBe(true)
  })

  it('accepts optional workspace bindings during session initialization', () => {
    const payload = Schema.decodeUnknownSync(InitializeSessionPayload)({
      worker: {
        id: 'agent_hosted',
        name: 'Hosted Agent',
        kind: 'agent',
      },
      permissions: ['workspace:read'],
      workspace_ids: ['workspace_hosted'],
    })

    expect(Option.getOrThrow(payload.workspace_ids)).toEqual([
      'workspace_hosted',
    ])
  })

  it('keeps protocol version compatibility as runtime negotiation', () => {
    const payload = Schema.decodeUnknownSync(InitializeSessionPayload)({
      protocol_version: '0.2',
      worker: {
        id: 'agent_future',
        name: 'Future Agent',
        kind: 'agent',
      },
    })

    expect(payload.protocol_version).toBe('0.2')
  })

  it('limits published work events to progress vocabulary (spec §12.6)', () => {
    const decode = Schema.decodeUnknownEither(PublishWorkEventPayload)
    expect(decode({ type: 'work.progressed', data: {} })._tag).toBe('Right')
    expect(decode({ type: 'work.claimed', data: {} })._tag).toBe('Left')
    expect(decode({ type: 'lease.granted', data: {} })._tag).toBe('Left')
    expect(decode({ type: 'review.approved', data: {} })._tag).toBe('Left')
  })

  it('declares the v0.1 REST routes from spec section 12', () => {
    expect(reflectEndpoints()).toEqual([
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
    ])
  })

  it('matches every explicit production /v1 router registration', () => {
    const typedRoutes = reflectEndpoints()
      .map(({ method, path }) => routeKey(method, path))
      .sort()

    expect(typedRoutes).toHaveLength(53)
    expect(typedRoutes).toEqual(productionV1RouteKeys())
  })

  it('extracts every supported HTTP method and rejects ambiguous routes', () => {
    const source = `
      HttpRouter.get('/v1/get', handler)
      HttpRouter.get('/v1', handler)
      HttpRouter.post('/v1/post', handler)
      HttpRouter.patch('/v1/patch', handler)
      HttpRouter.put('/v1/put', handler)
      HttpRouter.del('/v1/delete', handler)
      HttpRouter.head(router, '/v1/head', handler)
      HttpRouter.options('/v1/options', handler)
      HttpRouter.route('TRACE')('/v1/trace', handler)
    `

    expect(extractProductionV1RouteKeys(source)).toEqual(
      [
        'DELETE /v1/delete',
        'GET /v1/get',
        'GET /v1',
        'HEAD /v1/head',
        'OPTIONS /v1/options',
        'PATCH /v1/patch',
        'POST /v1/post',
        'PUT /v1/put',
        'TRACE /v1/trace',
      ].sort(),
    )
    expect(() =>
      extractProductionV1RouteKeys(`HttpRouter.all('/v1/wildcard', handler)`),
    ).toThrow('HttpRouter.all cannot declare a typed /v1 operation')
    expect(() =>
      extractProductionV1RouteKeys(`HttpRouter.put(dynamicPath, handler)`),
    ).toThrow('HttpRouter.put must declare a literal path')
    expect(() =>
      extractProductionV1RouteKeys(
        `HttpRouter.route(dynamicMethod)('/v1/dynamic', handler)`,
      ),
    ).toThrow('HttpRouter.route must declare a literal HTTP method')
  })
})
