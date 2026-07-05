/** @Acp.App.Cli.ReviewCommands.Test — review parser edge cases */
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

describe('review command parsing', () => {
  it('parses review approve with signed approval evidence', () => {
    const req = right([
      'review',
      'approve',
      'review_123',
      '--met',
      'tests_pass',
      '--signature',
      'sig:v1:abc123',
      '--signature-algorithm',
      'ssh-ed25519',
      '--signature-key',
      'github:user:human_chris:key1',
      '--signed-at',
      '2026-07-05T01:30:00.000Z',
    ])

    expect(req.body).toEqual({
      met_requirements: ['tests_pass'],
      approval_signature: {
        algorithm: 'ssh-ed25519',
        key_id: 'github:user:human_chris:key1',
        value: 'sig:v1:abc123',
        signed_at: '2026-07-05T01:30:00.000Z',
      },
    })
  })

  it('fails signed review approve when signature metadata is missing', () => {
    const parsed = parseArgs([
      'review',
      'approve',
      'review_123',
      '--met',
      'tests_pass',
      '--signature',
      'sig:v1:abc123',
    ])

    expect(Either.isLeft(parsed)).toBe(true)
    if (Either.isLeft(parsed)) {
      expect(parsed.left.message).toContain('--signature-algorithm')
    }
  })
})
