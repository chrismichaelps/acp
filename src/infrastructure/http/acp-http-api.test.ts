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
import { specV1Endpoints } from './spec-route-inventory-test-support.js'

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
    expect(reflectEndpoints()).toEqual(specV1Endpoints)
  })

  it('matches every explicit production /v1 router registration', () => {
    const typedRoutes = reflectEndpoints()
      .map(({ method, path }) => routeKey(method, path))
      .sort()

    expect(typedRoutes).toHaveLength(58)
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
