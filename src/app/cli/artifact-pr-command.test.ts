/** @Acp.App.Cli.ArtifactPrCommand.Test — pull request artifact argv parsing */
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

describe('artifact pr command', () => {
  it('records a pull request as an external artifact reference', () => {
    const req = right([
      'artifact',
      'pr',
      '--workspace',
      'workspace_1',
      '--work',
      'work_42',
      '--url',
      'https://github.com/chrismichaelps/acp/pull/143',
      '--summary',
      'Route tests now use bearer helper',
    ])

    expect(req).toEqual({
      method: 'POST',
      path: '/v1/artifacts',
      body: {
        workspace_id: 'workspace_1',
        work_id: 'work_42',
        kind: 'pull_request',
        uri: 'https://github.com/chrismichaelps/acp/pull/143',
        summary: 'Route tests now use bearer helper',
      },
      label: 'artifact pr',
    })
  })

  it('requires a pull request URL before sending the command', () => {
    const parsed = parseArgs([
      'artifact',
      'pr',
      '--workspace',
      'workspace_1',
      '--work',
      'work_42',
    ])

    expect(Either.isLeft(parsed)).toBe(true)
    if (Either.isLeft(parsed)) {
      expect(parsed.left.message).toContain('--url')
    }
  })
})
