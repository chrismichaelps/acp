/** @Acp.App.Cli.LeaseCommands.Test — lease argv mapping */
import { Either } from 'effect'
import { describe, expect, it } from 'vitest'
import type { CliRequest } from './commands.js'
import { parseArgs } from './commands.js'

const right = (argv: readonly string[]): CliRequest => {
  const parsed = parseArgs(argv)
  if (Either.isLeft(parsed)) throw new Error(parsed.left.message)
  return parsed.right
}

describe('lease commands', () => {
  it('parses lease request with a nested resource and numeric ttl', () => {
    const req = right([
      'lease',
      'request',
      '--workspace',
      'workspace_1',
      '--holder',
      'agent_x',
      '--kind',
      'file',
      '--uri',
      'file://src/a.ts',
      '--ttl',
      '900',
    ])
    expect(req.body).toEqual({
      workspace_id: 'workspace_1',
      holder: 'agent_x',
      resource: { kind: 'file', uri: 'file://src/a.ts' },
      ttl_seconds: 900,
    })
  })

  it('rejects an invalid lease ttl before it reaches HTTP decoding', () => {
    const parsed = parseArgs([
      'lease',
      'request',
      '--workspace',
      'workspace_1',
      '--holder',
      'agent_x',
      '--kind',
      'file',
      '--uri',
      'file://src/a.ts',
      '--ttl',
      'later',
    ])
    expect(Either.isLeft(parsed)).toBe(true)
    if (Either.isLeft(parsed)) {
      expect(parsed.left.message).toContain('--ttl')
    }
  })

  it('parses lease list as a workspace-scoped read request', () => {
    const req = right(['lease', 'list', '--workspace', 'workspace 1'])
    expect(req).toEqual({
      method: 'GET',
      path: '/v1/leases?workspace_id=workspace%201',
      label: 'lease list',
    })
  })

  it('records lease list --holder as a client-side filter', () => {
    const req = right([
      'lease',
      'list',
      '--workspace',
      'workspace 1',
      '--holder',
      'agent_worker',
    ])
    expect(req).toEqual({
      method: 'GET',
      path: '/v1/leases?workspace_id=workspace%201',
      clientFilters: [{ field: 'holder', value: 'agent_worker' }],
      label: 'lease list',
    })
  })

  it('parses lease release without a body', () => {
    const req = right(['lease', 'release', 'lease_123'])
    expect(req.path).toBe('/v1/leases/lease_123/release')
    expect(req.body).toBeUndefined()
  })

  it('parses lease renew and revoke commands', () => {
    const renew = right(['lease', 'renew', 'lease 123/main', '--ttl', '120'])
    expect(renew).toEqual({
      method: 'POST',
      path: '/v1/leases/lease%20123%2Fmain/renew',
      body: { ttl_seconds: 120 },
      label: 'lease renew',
    })

    const revoke = right(['lease', 'revoke', 'lease 123/main'])
    expect(revoke).toEqual({
      method: 'POST',
      path: '/v1/leases/lease%20123%2Fmain/revoke',
      label: 'lease revoke',
    })
  })
})
