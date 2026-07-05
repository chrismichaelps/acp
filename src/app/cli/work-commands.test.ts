/** @Acp.App.Cli.WorkCommands.Test — work argv mapping */
import { Either } from 'effect'
import { describe, expect, it } from 'vitest'
import type { CliRequest } from './commands.js'
import { parseArgs } from './commands.js'

const right = (argv: readonly string[]): CliRequest => {
  const parsed = parseArgs(argv)
  if (Either.isLeft(parsed)) throw new Error(parsed.left.message)
  return parsed.right
}

describe('work commands', () => {
  it('maps work list to the workspace collection route', () => {
    expect(right(['work', 'list', '--workspace', 'workspace_1'])).toEqual({
      method: 'GET',
      path: '/v1/workspaces/workspace_1/work',
      label: 'work list',
    })
  })

  it('records --state as a client-side filter without changing the route', () => {
    expect(
      right(['work', 'list', '--workspace', 'workspace_1', '--state', 'open']),
    ).toEqual({
      method: 'GET',
      path: '/v1/workspaces/workspace_1/work',
      clientFilters: [{ field: 'state', value: 'open' }],
      label: 'work list',
    })
  })

  it('records --priority as a client-side filter without changing the route', () => {
    expect(
      right([
        'work',
        'list',
        '--workspace',
        'workspace_1',
        '--priority',
        'high',
      ]),
    ).toEqual({
      method: 'GET',
      path: '/v1/workspaces/workspace_1/work',
      clientFilters: [{ field: 'priority', value: 'high' }],
      label: 'work list',
    })
  })

  it('records state and priority filters in request order', () => {
    expect(
      right([
        'work',
        'list',
        '--workspace',
        'workspace_1',
        '--state',
        'open',
        '--priority',
        'high',
      ]),
    ).toEqual({
      method: 'GET',
      path: '/v1/workspaces/workspace_1/work',
      clientFilters: [
        { field: 'state', value: 'open' },
        { field: 'priority', value: 'high' },
      ],
      label: 'work list',
    })
  })

  it('records --assigned-to as an assigned_to client-side filter', () => {
    expect(
      right([
        'work',
        'list',
        '--workspace',
        'workspace_1',
        '--assigned-to',
        'worker_1',
      ]),
    ).toEqual({
      method: 'GET',
      path: '/v1/workspaces/workspace_1/work',
      clientFilters: [{ field: 'assigned_to', value: 'worker_1' }],
      label: 'work list',
    })
  })

  it('omits clientFilters when filter flags are passed without values', () => {
    const req = right(['work', 'list', '--workspace', 'workspace_1', '--state'])
    expect(req.clientFilters).toBeUndefined()
  })
})
