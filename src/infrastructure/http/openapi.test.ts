/** @Acp.Infra.Http.OpenApi.Test — generated OpenAPI contract shape + determinism + drift gate */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ACP_PROTOCOL_VERSION } from '../../protocol/schema/index.js'
import { buildAcpOpenApi, serializeOpenApi } from './openapi.js'

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
