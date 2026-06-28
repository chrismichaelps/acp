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

  it('parses workspace create with optional default branch', () => {
    const req = right([
      'workspace',
      'create',
      '--name',
      'acme/web',
      '--kind',
      'git_repository',
      '--uri',
      'git+https://example.com/acme/web.git',
      '--default-branch',
      'main',
    ])
    expect(req.method).toBe('POST')
    expect(req.path).toBe('/v1/workspaces')
    expect(req.body).toEqual({
      name: 'acme/web',
      kind: 'git_repository',
      uri: 'git+https://example.com/acme/web.git',
      default_branch: 'main',
    })
  })

  it('fails workspace create when a required flag is missing', () => {
    const parsed = parseArgs([
      'workspace',
      'create',
      '--name',
      'acme/web',
      '--uri',
      'git+https://example.com/acme/web.git',
    ])
    expect(Either.isLeft(parsed)).toBe(true)
    if (Either.isLeft(parsed)) {
      expect(parsed.left.message).toContain('--kind')
    }
  })

  it('parses workspace update and encodes the workspace id', () => {
    const req = right([
      'workspace',
      'update',
      'workspace 1/main',
      '--name',
      'acme/web',
      '--kind',
      'git_repository',
      '--uri',
      'file:///repo',
    ])
    expect(req.method).toBe('PATCH')
    expect(req.path).toBe('/v1/workspaces/workspace%201%2Fmain')
    expect(req.body).toEqual({
      name: 'acme/web',
      kind: 'git_repository',
      uri: 'file:///repo',
    })
  })

  it('parses workspace archive without a body', () => {
    const req = right(['workspace', 'archive', 'workspace_123'])
    expect(req.method).toBe('POST')
    expect(req.path).toBe('/v1/workspaces/workspace_123/archive')
    expect(req.body).toBeUndefined()
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

  it('parses work get as a read request', () => {
    const req = right(['work', 'get', 'work 123/main'])
    expect(req).toEqual({
      method: 'GET',
      path: '/v1/work/work%20123%2Fmain',
      label: 'work get',
    })
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

  it('parses checkpoint list and latest by work', () => {
    expect(right(['checkpoint', 'list', '--work', 'work 1']).path).toBe(
      '/v1/work/work%201/checkpoints',
    )
    expect(right(['checkpoint', 'latest', '--work', 'work 1']).path).toBe(
      '/v1/work/work%201/checkpoints/latest',
    )
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

  it('parses artifact creation with an external uri', () => {
    const req = right([
      'artifact',
      'create',
      '--workspace',
      'workspace_1',
      '--work',
      'work_123',
      '--kind',
      'pull_request',
      '--uri',
      'https://example.com/acp/artifacts/pull-42',
      '--summary',
      'Review PR',
    ])
    expect(req.body).toEqual({
      workspace_id: 'workspace_1',
      work_id: 'work_123',
      kind: 'pull_request',
      uri: 'https://example.com/acp/artifacts/pull-42',
      summary: 'Review PR',
    })
  })

  it('parses artifact update with metadata and content fields', () => {
    const req = right([
      'artifact',
      'update',
      'artifact_123',
      '--kind',
      'report',
      '--uri',
      'https://ci.example.test/reports/123',
      '--media-type',
      'text/markdown',
      '--summary',
      'Updated report',
      '--content',
      '# Report',
    ])
    expect(req.method).toBe('PATCH')
    expect(req.path).toBe('/v1/artifacts/artifact_123')
    expect(req.body).toEqual({
      kind: 'report',
      uri: 'https://ci.example.test/reports/123',
      media_type: 'text/markdown',
      summary: 'Updated report',
      content: '# Report',
    })
  })

  it('parses artifact list by work', () => {
    const req = right(['artifact', 'list', '--work', 'work 123/main'])
    expect(req).toEqual({
      method: 'GET',
      path: '/v1/work/work%20123%2Fmain/artifacts',
      label: 'artifact list',
    })
  })

  it('parses artifact content with an encoded path and GET method', () => {
    const req = right(['artifact', 'content', 'artifact 123/main'])
    expect(req).toEqual({
      method: 'GET',
      path: '/v1/artifacts/artifact%20123%2Fmain/content',
      label: 'artifact content',
    })
  })

  it('parses artifact delete with an encoded path and DELETE method', () => {
    const req = right(['artifact', 'delete', 'artifact 1/old'])
    expect(req.method).toBe('DELETE')
    expect(req.path).toBe('/v1/artifacts/artifact%201%2Fold')
    expect(req.body).toBeUndefined()
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

  it('parses review list by work', () => {
    const req = right(['review', 'list', '--work', 'work 123/main'])
    expect(req).toEqual({
      method: 'GET',
      path: '/v1/work/work%20123%2Fmain/reviews',
      label: 'review list',
    })
  })

  it('parses review approve with comma-separated met requirements', () => {
    const req = right([
      'review',
      'approve',
      'review_123',
      '--met',
      'tests_pass, diff_review',
    ])
    expect(req.path).toBe('/v1/reviews/review_123/approve')
    expect(req.body).toEqual({
      met_requirements: ['tests_pass', 'diff_review'],
    })
  })

  it('fails review approve when --met is missing', () => {
    const parsed = parseArgs(['review', 'approve', 'review_123'])
    expect(Either.isLeft(parsed)).toBe(true)
    if (Either.isLeft(parsed)) {
      expect(parsed.left.message).toContain('--met')
    }
  })

  it('parses review reject without a body', () => {
    const req = right(['review', 'reject', 'review_123'])
    expect(req.path).toBe('/v1/reviews/review_123/reject')
    expect(req.body).toBeUndefined()
  })

  it('parses review request-changes without a body', () => {
    const req = right(['review', 'request-changes', 'review 123/main'])
    expect(req.path).toBe('/v1/reviews/review%20123%2Fmain/request_changes')
    expect(req.body).toBeUndefined()
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
