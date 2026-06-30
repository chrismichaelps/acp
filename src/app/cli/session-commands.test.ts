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
})
