/** @Acp.App.Cli.MemoryCommands.Test — memory argv parsing */
import { Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { parseArgs, type CliRequest } from './commands.js'

const right = (argv: readonly string[]): CliRequest => {
  const parsed = parseArgs(argv)
  if (Either.isLeft(parsed)) {
    throw new Error(`expected Right, got: ${parsed.left.message}`)
  }
  return parsed.right
}

describe('memory command parsing', () => {
  it('parses memory create with optional work and labels', () => {
    expect(
      right([
        'memory',
        'create',
        '--workspace',
        'workspace 1',
        '--kind',
        'decision',
        '--key',
        'auth',
        '--summary',
        'Bearer sessions',
        '--content',
        'Use bearer ids',
        '--work',
        'work 1',
        '--labels',
        'auth, security',
      ]),
    ).toEqual({
      method: 'POST',
      path: '/v1/memory',
      body: {
        workspace_id: 'workspace 1',
        kind: 'decision',
        key: 'auth',
        summary: 'Bearer sessions',
        content: 'Use bearer ids',
        labels: ['auth', 'security'],
        work_id: 'work 1',
      },
      label: 'memory create',
    })
  })

  it('defaults memory create labels to empty when omitted', () => {
    const request = right([
      'memory',
      'create',
      '--workspace',
      'w1',
      '--kind',
      'note',
      '--key',
      'k',
      '--summary',
      's',
      '--content',
      'c',
    ])
    expect(request.body).toEqual({
      workspace_id: 'w1',
      kind: 'note',
      key: 'k',
      summary: 's',
      content: 'c',
      labels: [],
    })
  })

  it('parses memory list rendering only provided filters', () => {
    expect(right(['memory', 'list', '--workspace', 'workspace 1'])).toEqual({
      method: 'GET',
      path: '/v1/memory?workspace_id=workspace%201&after_seq=0',
      label: 'memory list',
    })
    expect(
      right([
        'memory',
        'list',
        '--workspace',
        'w1',
        '--after',
        '5',
        '--limit',
        '10',
        '--kind',
        'handoff',
      ]),
    ).toEqual({
      method: 'GET',
      path: '/v1/memory?workspace_id=w1&after_seq=5&limit=10&kind=handoff',
      label: 'memory list',
    })
  })

  it('fails memory create when a required flag is missing', () => {
    const parsed = parseArgs(['memory', 'create', '--workspace', 'w1'])
    expect(Either.isLeft(parsed)).toBe(true)
  })
})
