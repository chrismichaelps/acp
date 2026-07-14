// @Acp.Scripts.Bump.Semver — strict release and protocol version arithmetic

const LEVELS = new Set(['major', 'minor', 'patch', 'none'])
const CANONICAL_NUMBER = '(0|[1-9][0-9]*)'
const RELEASE_PATTERN = new RegExp(
  `^${CANONICAL_NUMBER}\\.${CANONICAL_NUMBER}\\.${CANONICAL_NUMBER}$`,
)
const PROTOCOL_PATTERN = new RegExp(
  `^${CANONICAL_NUMBER}\\.${CANONICAL_NUMBER}$`,
)

function parseVersion(version, pattern, label) {
  if (typeof version !== 'string') {
    throw new TypeError(`${label} version must be a string`)
  }
  const match = pattern.exec(version)
  if (!match) {
    throw new Error(`invalid ${label} version: ${version}`)
  }

  const parts = match.slice(1).map(Number)
  if (parts.some((part) => !Number.isSafeInteger(part))) {
    throw new Error(`${label} version components must be safe integers`)
  }
  return parts
}

function assertLevel(level) {
  if (!LEVELS.has(level)) {
    throw new Error(`invalid semver level: ${String(level)}`)
  }
}

function increment(value) {
  if (value === Number.MAX_SAFE_INTEGER) {
    throw new Error('version increment exceeds the safe integer range')
  }
  return value + 1
}

export function bumpRelease(version, level) {
  assertLevel(level)
  const [major, minor, patch] = parseVersion(
    version,
    RELEASE_PATTERN,
    'release',
  )

  switch (level) {
    case 'major':
      return `${increment(major)}.0.0`
    case 'minor':
      return `${major}.${increment(minor)}.0`
    case 'patch':
      return `${major}.${minor}.${increment(patch)}`
    case 'none':
      return version
  }
}

export function bumpProtocol(version, level) {
  assertLevel(level)
  const [major, minor] = parseVersion(version, PROTOCOL_PATTERN, 'protocol')

  if (level === 'none' || level === 'patch') {
    return version
  }
  if (major === 0) {
    return `0.${increment(minor)}`
  }
  if (level === 'major') {
    return `${increment(major)}.0`
  }
  return `${major}.${increment(minor)}`
}
