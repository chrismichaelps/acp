/** @Acp.App.Cli.Commands.Test — argv parsing */
import { describe, expect, it } from 'vitest'
import { Either } from 'effect'
import { parseArgs } from './commands.js'
import type { CliRequest } from './commands.js'

const right = (argv: readonly string[]): CliRequest => {
  const parsed = parseArgs(argv)
  if (Either.isLeft(parsed)) {
    throw new Error(`expected Right, got: ${parsed.left.message}`)
  }
  return parsed.right
}

describe('parseArgs', () => {
  it('parses workspace list', () => {
    expect(right(['workspace', 'list'])).toEqual({
      method: 'GET',
      path: '/v1/workspaces',
      label: 'workspace list',
    })
  })

  it('parses work create with required workspace and optional flags', () => {
    const req = right([
      'work',
      'create',
      'Fix login bug',
      '--workspace',
      'workspace_1',
      '--priority',
      'high',
    ])
    expect(req.method).toBe('POST')
    expect(req.path).toBe('/v1/work')
    expect(req.body).toEqual({
      workspace_id: 'workspace_1',
      title: 'Fix login bug',
      priority: 'high',
    })
  })

  it('fails work create when --workspace is missing', () => {
    const parsed = parseArgs(['work', 'create', 'Fix bug'])
    expect(Either.isLeft(parsed)).toBe(true)
    if (Either.isLeft(parsed)) {
      expect(parsed.left.message).toContain('--workspace')
    }
  })

  it('parses work claim with the work id in the path', () => {
    const req = right(['work', 'claim', 'work_123', '--worker', 'agent_x'])
    expect(req.path).toBe('/v1/work/work_123/claim')
    expect(req.body).toEqual({ worker_id: 'agent_x' })
  })

  it('encodes path segments before sending route parameters', () => {
    const req = right(['work', 'claim', 'work 123/with slash', '--worker', 'a'])
    expect(req.path).toBe('/v1/work/work%20123%2Fwith%20slash/claim')
  })

  it('parses work update with the new state payload', () => {
    const req = right(['work', 'update', 'work_123', '--state', 'completed'])
    expect(req.method).toBe('PATCH')
    expect(req.path).toBe('/v1/work/work_123')
    expect(req.body).toEqual({ state: 'completed' })
  })

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

  it('parses lease release without a body', () => {
    const req = right(['lease', 'release', 'lease_123'])
    expect(req.path).toBe('/v1/leases/lease_123/release')
    expect(req.body).toBeUndefined()
  })

  it('parses checkpoint creation with empty step lists', () => {
    const req = right([
      'checkpoint',
      'create',
      '--workspace',
      'workspace_1',
      '--work',
      'work_123',
      '--summary',
      'Narrowed failure to auth callback',
    ])
    expect(req.path).toBe('/v1/checkpoints')
    expect(req.body).toEqual({
      workspace_id: 'workspace_1',
      work_id: 'work_123',
      summary: 'Narrowed failure to auth callback',
      completed_steps: [],
      remaining_steps: [],
      modified_resources: [],
    })
  })

  it('parses artifact creation with content and summary flags', () => {
    const req = right([
      'artifact',
      'create',
      '--workspace',
      'workspace_1',
      '--work',
      'work_123',
      '--kind',
      'patch',
      '--summary',
      'Fix patch',
      '--content',
      'diff --git ...',
    ])
    expect(req.path).toBe('/v1/artifacts')
    expect(req.body).toEqual({
      workspace_id: 'workspace_1',
      work_id: 'work_123',
      kind: 'patch',
      summary: 'Fix patch',
      content: 'diff --git ...',
    })
  })

  it('parses review requests with an optional reviewer', () => {
    const req = right([
      'review',
      'request',
      '--work',
      'work_123',
      '--by',
      'agent_x',
      '--reviewer',
      'human_chris',
    ])
    expect(req.path).toBe('/v1/reviews')
    expect(req.body).toEqual({
      work_id: 'work_123',
      requested_by: 'agent_x',
      requirements: [],
      reviewer: 'human_chris',
    })
  })

  it('marks events stream as streaming with the workspace query', () => {
    const req = right(['events', 'stream', '--workspace', 'workspace 1'])
    expect(req.stream).toBe(true)
    expect(req.path).toBe('/v1/events/stream?workspace_id=workspace%201')
  })

  it('rejects an unknown command', () => {
    const parsed = parseArgs(['frobnicate', 'now'])
    expect(Either.isLeft(parsed)).toBe(true)
  })
})
