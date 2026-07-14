// @Acp.Scripts.Bump.Semver.Test — strict release and protocol arithmetic
import { describe, expect, it } from 'vitest'
import { bumpProtocol, bumpRelease } from './semver.mjs'

describe('bumpRelease', () => {
  it.each([
    ['major', '2.0.0'],
    ['minor', '1.5.0'],
    ['patch', '1.4.3'],
    ['none', '1.4.2'],
  ])('applies %s', (level, expected) => {
    expect(bumpRelease('1.4.2', level)).toBe(expected)
  })

  it.each(['1.2', '01.2.3', '1.-2.3', '1.x.3', '1.2.3.4'])(
    'rejects malformed release version %s',
    (version) =>
      expect(() => bumpRelease(version, 'patch')).toThrow(/release version/),
  )

  it('rejects unsafe integer overflow', () => {
    expect(() =>
      bumpRelease(`${Number.MAX_SAFE_INTEGER}.0.0`, 'major'),
    ).toThrow(/safe integer/)
  })

  it('rejects unknown levels', () => {
    expect(() => bumpRelease('1.2.3', 'banana')).toThrow(/semver level/)
  })
})

describe('bumpProtocol', () => {
  it.each([
    ['major', '0.2'],
    ['minor', '0.2'],
    ['patch', '0.1'],
    ['none', '0.1'],
  ])('applies the 0.x %s rule', (level, expected) => {
    expect(bumpProtocol('0.1', level)).toBe(expected)
  })

  it.each([
    ['major', '2.0'],
    ['minor', '1.5'],
    ['patch', '1.4'],
  ])('applies the stable %s rule', (level, expected) => {
    expect(bumpProtocol('1.4', level)).toBe(expected)
  })

  it.each(['0', '0.01', '0.-1', 'x.1', '0.1.0'])(
    'rejects malformed protocol version %s',
    (version) =>
      expect(() => bumpProtocol(version, 'minor')).toThrow(/protocol version/),
  )
})
