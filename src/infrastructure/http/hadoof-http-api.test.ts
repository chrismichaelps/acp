/** @Acp.Infra.Http.Api.Test — reflected route contract */
import { describe, expect, it } from 'vitest'
import { HttpApi } from '@effect/platform'
import { HadoofHttpApi } from './index.js'

interface ReflectedEndpoint {
  readonly group: string
  readonly name: string
  readonly method: string
  readonly path: string
}

const reflectEndpoints = (): readonly ReflectedEndpoint[] => {
  const endpoints: ReflectedEndpoint[] = []
  HttpApi.reflect(HadoofHttpApi, {
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

describe('HadoofHttpApi', () => {
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
      { group: 'work', name: 'createWork', method: 'POST', path: '/v1/work' },
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
        group: 'events',
        name: 'streamEvents',
        method: 'GET',
        path: '/v1/events/stream',
      },
    ])
  })
})
