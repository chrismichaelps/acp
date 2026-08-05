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
  it('maps --parent to a parent_id on work create', () => {
    expect(
      right([
        'work',
        'create',
        'Migrate the schema',
        '--workspace',
        'workspace_1',
        '--parent',
        'work_parent',
      ]),
    ).toEqual({
      method: 'POST',
      path: '/v1/work',
      body: {
        workspace_id: 'workspace_1',
        title: 'Migrate the schema',
        parent_id: 'work_parent',
      },
      label: 'work create',
    })
  })

  it('omits parent_id when --parent is absent', () => {
    const request = right([
      'work',
      'create',
      'Root task',
      '--workspace',
      'workspace_1',
    ])
    expect(request.body).toEqual({
      workspace_id: 'workspace_1',
      title: 'Root task',
    })
  })

  it('maps work children to the direct-children route', () => {
    expect(right(['work', 'children', 'work_1'])).toEqual({
      method: 'GET',
      path: '/v1/work/work_1/children',
      label: 'work children',
    })
  })

  it('maps work descendants without bounds', () => {
    expect(right(['work', 'descendants', 'work_1'])).toEqual({
      method: 'GET',
      path: '/v1/work/work_1/descendants',
      label: 'work descendants',
    })
  })

  it('passes descendant bounds through as query parameters', () => {
    expect(
      right([
        'work',
        'descendants',
        'work_1',
        '--max-depth',
        '2',
        '--limit',
        '50',
      ]),
    ).toEqual({
      method: 'GET',
      path: '/v1/work/work_1/descendants?max_depth=2&limit=50',
      label: 'work descendants',
    })
  })

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

  it('maps work resume to the compact resume packet route', () => {
    expect(right(['work', 'resume', 'work 123/main'])).toEqual({
      method: 'GET',
      path: '/v1/work/work%20123%2Fmain/resume',
      label: 'work resume',
    })
  })

  it('passes --budget through as a resume query for a bounded packet', () => {
    expect(right(['work', 'resume', 'work_1', '--budget', '5'])).toEqual({
      method: 'GET',
      path: '/v1/work/work_1/resume?budget=5',
      label: 'work resume',
    })
  })
})
