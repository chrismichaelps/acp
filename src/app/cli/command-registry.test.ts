/** @Acp.App.Cli.CommandRegistry.Test — command table composition guardrails */
import { Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { buildCommandRegistry } from './commands.js'
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
