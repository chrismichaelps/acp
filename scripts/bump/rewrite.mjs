// @Acp.Scripts.Bump.Rewrite — anchor-validated version and changelog transforms

const RELEASE_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/
const PROTOCOL_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/
const PACKAGE_ANCHOR = /"version"\s*:\s*"([^"]*)"/g
const PROTOCOL_ANCHOR =
  /^export const ACP_PROTOCOL_VERSION\s*=\s*(['"])([^'"]+)\1\s+as const\s*$/gm
const CHANGELOG_HEADING = /^# Changelog\r?$/gm

function assertVersion(version, pattern, label) {
  if (typeof version !== 'string' || !pattern.test(version)) {
    throw new Error(`invalid ${label} version: ${String(version)}`)
  }
}

function matches(text, pattern) {
  return [...text.matchAll(pattern)]
}

export function rewritePackageVersion(text, expected, next) {
  assertVersion(expected, RELEASE_PATTERN, 'expected release')
  assertVersion(next, RELEASE_PATTERN, 'next release')

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Error('package source must be valid JSON', { cause: error })
  }
  if (
    parsed === null ||
    Array.isArray(parsed) ||
    typeof parsed !== 'object' ||
    typeof parsed.version !== 'string'
  ) {
    throw new Error('package source must contain a top-level version string')
  }
  if (parsed.version !== expected) {
    throw new Error(
      `expected package version ${expected}, found ${parsed.version}`,
    )
  }

  const anchors = matches(text, PACKAGE_ANCHOR)
  if (anchors.length !== 1) {
    throw new Error(
      'package source must contain exactly one textual package version anchor',
    )
  }
  if (anchors[0][1] !== expected) {
    throw new Error(
      `textual package version does not match expected ${expected}`,
    )
  }

  const anchor = anchors[0]
  const valueOffset = anchor[0].indexOf(anchor[1])
  const start = anchor.index + valueOffset
  return `${text.slice(0, start)}${next}${text.slice(start + expected.length)}`
}

export function rewriteProtocolVersion(text, expected, next) {
  assertVersion(expected, PROTOCOL_PATTERN, 'expected protocol')
  assertVersion(next, PROTOCOL_PATTERN, 'next protocol')
  const anchors = matches(text, PROTOCOL_ANCHOR)
  if (anchors.length !== 1) {
    throw new Error('source must contain exactly one protocol version anchor')
  }
  if (anchors[0][2] !== expected) {
    throw new Error(
      `expected protocol version ${expected}, found ${anchors[0][2]}`,
    )
  }

  const anchor = anchors[0]
  const valueOffset = anchor[0].indexOf(anchor[2])
  const start = anchor.index + valueOffset
  return `${text.slice(0, start)}${next}${text.slice(start + expected.length)}`
}

export function changelogEntry({ date, release, protocol }) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('changelog date must use YYYY-MM-DD')
  }

  const changes = []
  if (release?.current !== release?.next) {
    changes.push(`release ${release.current} → ${release.next}`)
  }
  if (protocol?.current !== protocol?.next) {
    changes.push(`protocol ${protocol.current} → ${protocol.next}`)
  }
  if (changes.length === 0) {
    throw new Error('changelog entry requires at least one version change')
  }

  return `- ${date} · version bump · ${changes.join(' · ')}`
}

export function prependChangelogEntry(text, entry) {
  if (typeof text !== 'string' || typeof entry !== 'string') {
    throw new TypeError('changelog text and entry must be strings')
  }
  if (!entry.startsWith('- ') || /[\r\n]/.test(entry)) {
    throw new Error('changelog entry must be a single Markdown list item')
  }

  const headings = matches(text, CHANGELOG_HEADING)
  if (headings.length !== 1) {
    throw new Error(
      'changelog source must contain exactly one changelog heading',
    )
  }

  const headingEnd = headings[0].index + headings[0][0].length
  const firstEntry = text.indexOf('\n- ', headingEnd)
  if (firstEntry >= 0) {
    const insertion = firstEntry + 1
    return `${text.slice(0, insertion)}${entry}\n\n${text.slice(insertion)}`
  }

  const separator = text.endsWith('\n\n')
    ? ''
    : text.endsWith('\n')
      ? '\n'
      : '\n\n'
  return `${text}${separator}${entry}\n`
}
