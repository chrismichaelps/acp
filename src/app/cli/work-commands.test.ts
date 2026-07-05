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
      filterState: 'open',
      label: 'work list',
    })
  })

  it('omits filterState when --state is passed without a value', () => {
    const req = right(['work', 'list', '--workspace', 'workspace_1', '--state'])
    expect(req.filterState).toBeUndefined()
  })
})
