/** @Acp.App.Cli.EventCommands.Test — event argv parsing */
import { describe, expect, it } from 'vitest'
import { parseArgs } from './commands.js'
import { Either } from 'effect'
import type { CliRequest } from './commands.js'

const right = (argv: readonly string[]): CliRequest => {
  const parsed = parseArgs(argv)
  if (Either.isLeft(parsed)) {
    throw new Error(`expected Right, got: ${parsed.left.message}`)
  }
  return parsed.right
}

describe('event command parsing', () => {
  it('marks events stream as streaming with the workspace query', () => {
    const req = right(['events', 'stream', '--workspace', 'workspace 1'])
    expect(req.stream).toBe(true)
    expect(req.path).toBe('/v1/events/stream?workspace_id=workspace%201')
  })

  it('parses events list with an optional replay cursor', () => {
    expect(right(['events', 'list', '--workspace', 'workspace 1'])).toEqual({
      method: 'GET',
      path: '/v1/events?workspace_id=workspace%201&after_seq=0',
      label: 'events list',
    })
    expect(
      right(['events', 'list', '--workspace', 'workspace 1', '--after', '7']),
    ).toEqual({
      method: 'GET',
      path: '/v1/events?workspace_id=workspace%201&after_seq=7',
      label: 'events list',
    })
  })

  it('records events list --type as a client-side filter', () => {
    expect(
      right([
        'events',
        'list',
        '--workspace',
        'workspace 1',
        '--after',
        '7',
        '--type',
        'work.completed',
      ]),
    ).toEqual({
      method: 'GET',
      path: '/v1/events?workspace_id=workspace%201&after_seq=7',
      clientFilters: [{ field: 'type', value: 'work.completed' }],
      label: 'events list',
    })
  })

  it('parses events list with a server-side replay limit', () => {
    expect(
      right([
        'events',
        'list',
        '--workspace',
        'workspace 1',
        '--after',
        '7',
        '--limit',
        '2',
      ]),
    ).toEqual({
      method: 'GET',
      path: '/v1/events?workspace_id=workspace%201&after_seq=7&limit=2',
      label: 'events list',
    })
  })

  it('rejects non-positive event replay limits', () => {
    const parsed = parseArgs([
      'events',
      'list',
      '--workspace',
      'workspace 1',
      '--limit',
      '0',
    ])
    expect(Either.isLeft(parsed)).toBe(true)
    if (Either.isLeft(parsed)) {
      expect(parsed.left.message).toBe('invalid --limit: 0')
    }
  })
})
