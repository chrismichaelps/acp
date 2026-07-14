// @Acp.Scripts.Bump.Policy.Test — release inference and explicit protocol intent
import { describe, expect, it } from 'vitest'
import {
  classifyProtocol,
  classifyRelease,
  planBump,
  validateReleaseOverride,
} from './policy.mjs'

const base = {
  commits: [],
  protocolSurfaceChanged: false,
  protocolFiles: [],
}

describe('classifyRelease', () => {
  it.each([
    [[{ type: 'feat', breaking: false }], 'minor'],
    [[{ type: 'fix', breaking: false }], 'patch'],
    [[{ type: 'perf', breaking: false }], 'patch'],
    [[{ type: 'docs', breaking: false }], 'none'],
    [[{ type: 'fix', breaking: true }], 'major'],
  ])('classifies evidence %#', (commits, expected) => {
    expect(classifyRelease({ ...base, commits }).level).toBe(expected)
  })

  it('selects the highest level across commits', () => {
    expect(
      classifyRelease({
        ...base,
        commits: [
          { type: 'fix', breaking: false },
          { type: 'feat', breaking: false },
        ],
      }).level,
    ).toBe('minor')
  })

  it('warns without bumping for unknown commits', () => {
    const proposal = classifyRelease({
      ...base,
      commits: [{ type: 'unknown', breaking: false }],
    })
    expect(proposal.level).toBe('none')
    expect(proposal.warnings.join(' ')).toMatch(/unknown/)
  })
})

describe('classifyProtocol', () => {
  it('never infers a protocol bump from touched files', () => {
    const proposal = classifyProtocol({
      ...base,
      protocolSurfaceChanged: true,
      protocolFiles: ['src/protocol/version.ts'],
    })
    expect(proposal.level).toBe('none')
    expect(proposal.warnings.join(' ')).toMatch(/explicit --protocol/)
  })
})

describe('validateReleaseOverride', () => {
  it('accepts an override at or above evidence', () => {
    expect(validateReleaseOverride('patch', 'minor', false)).toEqual({
      ok: true,
      level: 'minor',
    })
  })

  it('refuses an evidence undercut unless forced', () => {
    expect(validateReleaseOverride('major', 'patch', false).ok).toBe(false)
    expect(validateReleaseOverride('major', 'patch', true)).toEqual({
      ok: true,
      level: 'patch',
    })
  })
})

describe('planBump', () => {
  it('keeps release and protocol decisions independent', () => {
    const plan = planBump({
      signals: {
        commits: [{ type: 'feat', breaking: false }],
        protocolSurfaceChanged: true,
        protocolFiles: ['src/protocol/schema/common.ts'],
      },
      current: { release: '1.0.0', protocol: '0.1' },
      overrides: { release: null, protocol: null },
      force: false,
    })
    expect(plan.release).toMatchObject({ level: 'minor', next: '1.1.0' })
    expect(plan.protocol).toMatchObject({ level: 'none', next: '0.1' })
    expect(plan.violations).toEqual([])
  })

  it('applies explicit protocol intent', () => {
    const plan = planBump({
      signals: base,
      current: { release: '1.0.0', protocol: '0.1' },
      overrides: { release: null, protocol: 'major' },
      force: false,
    })
    expect(plan.protocol).toMatchObject({ level: 'major', next: '0.2' })
  })

  it('returns a violation without applying a lower release override', () => {
    const plan = planBump({
      signals: {
        ...base,
        commits: [{ type: 'feat', breaking: true }],
      },
      current: { release: '1.0.0', protocol: '0.1' },
      overrides: { release: 'patch', protocol: null },
      force: false,
    })
    expect(plan.release.level).toBe('major')
    expect(plan.violations).toHaveLength(1)
  })
})
