/** @Acp.App.Cli.SessionCommands.Test — session bootstrap argv parsing */
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

describe('session commands', () => {
  it('parses session init as the open bearer-session bootstrap route', () => {
    const req = right([
      'session',
      'init',
      '--worker',
      'agent_codex',
      '--name',
      'Codex',
      '--vendor',
      'openai',
      '--capabilities',
      'can_edit_files,supports_checkpoints',
      '--permissions',
      'workspace:read,work:create,event:read',
    ])

    expect(req).toEqual({
      method: 'POST',
      path: '/v1/session/initialize',
      body: {
        worker: {
          id: 'agent_codex',
          name: 'Codex',
          kind: 'agent',
          vendor: 'openai',
          capabilities: ['can_edit_files', 'supports_checkpoints'],
        },
        permissions: ['workspace:read', 'work:create', 'event:read'],
      },
      label: 'session init',
    })
  })

  it('requires worker identity fields before bootstrapping a session', () => {
    const parsed = parseArgs(['session', 'init', '--worker', 'agent_codex'])

    expect(Either.isLeft(parsed)).toBe(true)
    if (Either.isLeft(parsed)) {
      expect(parsed.left.message).toContain('--name')
    }
  })

  it('normalizes repeated and comma-separated workspace bindings', () => {
    const req = right([
      'session',
      'init',
      '--worker',
      'agent_codex',
      '--name',
      'Codex',
      '--permissions',
      'work:create',
      '--workspace',
      'workspace_alpha, workspace_beta',
      '--workspace',
      'workspace_beta',
      '--workspace',
      'workspace_gamma',
    ])

    expect(req.body).toEqual({
      worker: {
        id: 'agent_codex',
        name: 'Codex',
        kind: 'agent',
        capabilities: [],
      },
      permissions: ['work:create'],
      workspace_ids: ['workspace_alpha', 'workspace_beta', 'workspace_gamma'],
    })
  })

  it.each([
    ['missing value', ['--workspace']],
    ['empty identifier', ['--workspace', 'workspace_alpha,']],
    ['malformed identifier', ['--workspace', 'project_alpha']],
  ])('rejects %s in workspace bindings', (_label, workspaceArgs) => {
    const parsed = parseArgs([
      'session',
      'init',
      '--worker',
      'agent_codex',
      '--name',
      'Codex',
      ...workspaceArgs,
    ])

    expect(Either.isLeft(parsed)).toBe(true)
    if (Either.isLeft(parsed)) {
      expect(parsed.left.message).toContain('invalid --workspace')
    }
  })
})
