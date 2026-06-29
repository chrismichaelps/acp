/** @Acp.Infra.Http.Api.Test — reflected route contract */
import { describe, expect, it } from 'vitest'
import { HttpApi } from '@effect/platform'
import { Schema } from 'effect'
import { AcpHttpApi, InitializeSessionPayload } from './index.js'

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

  it('declares the v0.1 REST routes from spec section 12', () => {
    expect(reflectEndpoints()).toEqual([
      {
        group: 'session',
        name: 'initializeSession',
        method: 'POST',
        path: '/v1/session/initialize',
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
        name: 'requestLease',
        method: 'POST',
        path: '/v1/leases',
      },
      {
        group: 'leases',
        name: 'releaseLease',
        method: 'POST',
        path: '/v1/leases/:lease_id/release',
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
        group: 'events',
        name: 'streamEvents',
        method: 'GET',
        path: '/v1/events/stream',
      },
    ])
  })
})
