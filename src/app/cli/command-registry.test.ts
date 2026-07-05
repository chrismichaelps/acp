/** @Acp.App.Cli.CommandRegistry.Test — command table composition guardrails */
import { Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { buildCommandParser, buildCommandRegistry } from './commands.js'
import type { CommandHandler } from './command-support.js'

describe('buildCommandRegistry', () => {
  it('rejects duplicate command registrations', () => {
    const handler: CommandHandler = () =>
      Either.right({
        method: 'GET',
        path: '/v1/workers',
        label: 'worker list',
      })

    expect(() =>
      buildCommandRegistry([
        { 'worker list': handler },
        { 'worker list': handler },
      ]),
    ).toThrow('duplicate CLI command handler: worker list')
  })
})

describe('buildCommandParser', () => {
  it('routes one-, two-, and three-token command prefixes', () => {
    const version: CommandHandler = () =>
      Either.right({ method: 'GET', path: '/version', label: 'version' })
    const workerList: CommandHandler = () =>
      Either.right({
        method: 'GET',
        path: '/v1/workers',
        label: 'worker list',
      })
    const cacheClear: CommandHandler = ({ positionals }) =>
      Either.right({
        method: 'POST',
        path: `/cache/${positionals[0]}`,
        label: 'workspace cache clear',
      })

    const parse = buildCommandParser([
      {
        version,
        'worker list': workerList,
        'workspace cache clear': cacheClear,
      },
    ])

    expect(parse(['version'])).toEqual(
      Either.right({ method: 'GET', path: '/version', label: 'version' }),
    )
    expect(parse(['worker', 'list'])).toEqual(
      Either.right({
        method: 'GET',
        path: '/v1/workers',
        label: 'worker list',
      }),
    )
    expect(parse(['workspace', 'cache', 'clear', 'workspace_1'])).toEqual(
      Either.right({
        method: 'POST',
        path: '/cache/workspace_1',
        label: 'workspace cache clear',
      }),
    )
  })

  it('uses the longest registered command prefix', () => {
    const shorter: CommandHandler = () =>
      Either.right({ method: 'GET', path: '/short', label: 'short' })
    const longer: CommandHandler = ({ positionals }) =>
      Either.right({
        method: 'GET',
        path: `/long/${positionals[0]}`,
        label: 'long',
      })

    const parse = buildCommandParser([
      {
        'workspace cache': shorter,
        'workspace cache clear': longer,
      },
    ])

    expect(parse(['workspace', 'cache', 'clear', 'workspace_1'])).toEqual(
      Either.right({
        method: 'GET',
        path: '/long/workspace_1',
        label: 'long',
      }),
    )
  })
})
