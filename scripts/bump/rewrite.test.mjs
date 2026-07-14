// @Acp.Scripts.Bump.Rewrite.Test — validated version and changelog transforms
import { describe, expect, it } from 'vitest'
import {
  changelogEntry,
  prependChangelogEntry,
  rewritePackageVersion,
  rewriteProtocolVersion,
} from './rewrite.mjs'

describe('rewritePackageVersion', () => {
  const packageText = '{\n  "name": "acp",\n  "version": "1.0.0"\n}\n'

  it('rewrites only the top-level package version anchor', () => {
    expect(rewritePackageVersion(packageText, '1.0.0', '1.1.0')).toBe(
      '{\n  "name": "acp",\n  "version": "1.1.0"\n}\n',
    )
  })

  it.each([
    ['not json', /valid JSON/],
    ['{"version":"2.0.0"}', /expected package version/],
    ['{"name":"acp"}', /top-level version/],
    [
      '{"version":"1.0.0","nested":{"version":"1.0.0"}}',
      /exactly one textual package version anchor/,
    ],
  ])('rejects an unsafe package source %#', (text, error) => {
    expect(() => rewritePackageVersion(text, '1.0.0', '1.1.0')).toThrow(error)
  })
})

describe('rewriteProtocolVersion', () => {
  const source = "export const ACP_PROTOCOL_VERSION = '0.1' as const\n"

  it('rewrites the canonical protocol constant', () => {
    expect(rewriteProtocolVersion(source, '0.1', '0.2')).toBe(
      "export const ACP_PROTOCOL_VERSION = '0.2' as const\n",
    )
  })

  it.each([
    ["export const OTHER = '0.1'\n", /exactly one protocol version anchor/],
    [
      `${source}export const ACP_PROTOCOL_VERSION = '0.1' as const\n`,
      /exactly one protocol version anchor/,
    ],
    [
      "export const ACP_PROTOCOL_VERSION = '0.2' as const\n",
      /expected protocol/,
    ],
  ])('rejects an unsafe protocol source %#', (text, error) => {
    expect(() => rewriteProtocolVersion(text, '0.1', '0.2')).toThrow(error)
  })
})

describe('changelog transforms', () => {
  it('formats only changed version lines', () => {
    expect(
      changelogEntry({
        date: '2026-07-13',
        release: { current: '1.0.0', next: '1.1.0' },
        protocol: { current: '0.1', next: '0.1' },
      }),
    ).toBe('- 2026-07-13 · version bump · release 1.0.0 → 1.1.0')
  })

  it('formats independent release and protocol changes', () => {
    expect(
      changelogEntry({
        date: '2026-07-13',
        release: { current: '1.0.0', next: '2.0.0' },
        protocol: { current: '0.1', next: '0.2' },
      }),
    ).toBe(
      '- 2026-07-13 · version bump · release 1.0.0 → 2.0.0 · protocol 0.1 → 0.2',
    )
  })

  it('inserts before the existing newest ledger entry', () => {
    const text =
      '# Changelog\n\nTemporal ledger of changes.\n\n- 2026-07-12 · prior\n'
    expect(prependChangelogEntry(text, '- 2026-07-13 · next')).toBe(
      '# Changelog\n\nTemporal ledger of changes.\n\n- 2026-07-13 · next\n\n- 2026-07-12 · prior\n',
    )
  })

  it('rejects missing or repeated changelog headings', () => {
    expect(() => prependChangelogEntry('No heading\n', '- entry')).toThrow(
      /exactly one changelog heading/,
    )
    expect(() =>
      prependChangelogEntry('# Changelog\n# Changelog\n', '- entry'),
    ).toThrow(/exactly one changelog heading/)
  })

  it('rejects an empty bump entry', () => {
    expect(() =>
      changelogEntry({
        date: '2026-07-13',
        release: { current: '1.0.0', next: '1.0.0' },
        protocol: { current: '0.1', next: '0.1' },
      }),
    ).toThrow(/at least one version change/)
  })
})
