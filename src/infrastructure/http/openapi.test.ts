/** @Acp.Infra.Http.OpenApi.Test — generated OpenAPI contract shape + determinism + drift gate */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ACP_PROTOCOL_VERSION } from '../../protocol/schema/index.js'
import { buildAcpOpenApi, serializeOpenApi } from './openapi.js'
import {
  productionV1RouteKeys,
  routeKey,
} from './production-route-inventory-test-support.js'

const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const

const publishedOperations = (spec: ReturnType<typeof buildAcpOpenApi>) =>
  Object.entries(spec.paths).flatMap(([path, pathItem]) =>
    HTTP_METHODS.flatMap((method) => {
      const operation = pathItem[method]
      return operation === undefined ? [] : [{ method, path, operation }]
    }),
  )

describe('buildAcpOpenApi', () => {
  it('emits an OpenAPI 3.x document with pinned identity', () => {
    const spec = buildAcpOpenApi()
    expect(spec.openapi).toMatch(/^3\./)
    expect(spec.info.title).toBe('ACP')
    expect(spec.info.version).toBe(ACP_PROTOCOL_VERSION)
    expect(spec.info.description).toContain('Agent Coordination Protocol')
  })

  it('describes the real REST surface', () => {
    const spec = buildAcpOpenApi()
    expect(Object.keys(spec.paths)).toContain('/v1/session/initialize')
    expect(Object.keys(spec.paths)).toContain('/v1/work')
    // path params render in OpenAPI brace form, not the Effect `:param` form
    expect(Object.keys(spec.paths)).toContain('/v1/work/{work_id}')
  })

  it('describes phase-specific bearer auth for issuance and sessions', () => {
    const spec = buildAcpOpenApi()
    expect(spec.components.securitySchemes.AcpSession).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'ACP session id',
      description:
        'Session credential returned by POST /v1/session/initialize.',
    })
    expect(spec.components.securitySchemes.AcpIssuance).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'ACP issuance credential',
      description:
        'Optional deployment-issued credential used only by POST /v1/session/initialize.',
    })
    expect(spec.security).toEqual([{ AcpSession: [] }])

    const operations = publishedOperations(spec)
    expect(operations).toHaveLength(53)

    for (const { operation } of operations) {
      expect(operation.security).toEqual(
        operation.operationId === 'session.initializeSession'
          ? [{ AcpIssuance: [] }, {}]
          : [{ AcpSession: [] }],
      )
      if (operation.operationId !== 'session.initializeSession') {
        expect(operation.responses[401]).toBeDefined()
        expect(operation.responses[403]).toBeDefined()
      }
    }
  })

  it('matches every explicit production /v1 router registration', () => {
    const published = publishedOperations(buildAcpOpenApi())
      .map(({ method, path }) => routeKey(method, path))
      .sort()

    expect(published).toHaveLength(53)
    expect(published).toEqual(productionV1RouteKeys())
  })

  it('is deterministic so the committed artifact cannot flap', () => {
    expect(serializeOpenApi(buildAcpOpenApi())).toBe(
      serializeOpenApi(buildAcpOpenApi()),
    )
  })
})

describe('committed openapi.json artifact', () => {
  it('matches the current contract (run `pnpm openapi:generate` if this fails)', () => {
    const committed = readFileSync('openapi.json', 'utf8')
    expect(serializeOpenApi(buildAcpOpenApi())).toBe(committed)
  })
})
