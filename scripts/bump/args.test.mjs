// @Acp.Scripts.Bump.Args.Test — strict bump command grammar
import { describe, expect, it } from 'vitest'
import { parseArgs } from './args.mjs'

describe('parseArgs', () => {
  it('parses an explicit bump plan', () => {
    expect(
      parseArgs([
        '--release',
        'minor',
        '--protocol',
        'none',
        '--since',
        'origin/main',
        '--force',
        '--yes',
      ]),
    ).toEqual({
      mode: 'bump',
      release: 'minor',
      protocol: 'none',
      since: 'origin/main',
      force: true,
      yes: true,
      dryRun: false,
    })
  })

  it('parses baseline dry-run without bump flags', () => {
    expect(parseArgs(['--baseline', '--dry-run'])).toEqual({
      mode: 'baseline',
      release: null,
      protocol: null,
      since: null,
      force: false,
      yes: false,
      dryRun: true,
    })
  })

  it.each([
    [['--wat'], /unknown flag/],
    [['--release'], /requires a value/],
    [['--release', 'banana'], /invalid release level/],
    [['--protocol', 'minor', '--protocol', 'major'], /repeated flag/],
    [['--baseline', '--release', 'minor'], /baseline mode/],
    [['--baseline', '--since', 'HEAD~1'], /baseline mode/],
    [['--baseline', '--force'], /baseline mode/],
    [['--yes', '--dry-run'], /cannot be combined/],
  ])('rejects invalid argv %#', (argv, message) => {
    expect(() => parseArgs(argv)).toThrow(message)
  })
})
