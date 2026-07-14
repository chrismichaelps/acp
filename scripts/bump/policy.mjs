// @Acp.Scripts.Bump.Policy — independent release and protocol bump policy

import { bumpProtocol, bumpRelease } from './semver.mjs'

const RANK = Object.freeze({ none: 0, patch: 1, minor: 2, major: 3 })
const PATCH_TYPES = new Set(['fix', 'perf'])
const NONE_TYPES = new Set([
  'build',
  'chore',
  'ci',
  'docs',
  'refactor',
  'style',
  'test',
])

function highest(left, right) {
  return RANK[right] > RANK[left] ? right : left
}

export function classifyRelease(signals) {
  let level = 'none'
  const reasons = []
  const warnings = []

  for (const commit of signals.commits) {
    let contribution = 'none'
    if (commit.breaking) {
      contribution = 'major'
    } else if (commit.type === 'feat') {
      contribution = 'minor'
    } else if (PATCH_TYPES.has(commit.type)) {
      contribution = 'patch'
    } else if (!NONE_TYPES.has(commit.type)) {
      warnings.push(
        `unknown commit type ${JSON.stringify(commit.type)} contributes no release bump`,
      )
    }

    level = highest(level, contribution)
  }

  if (level === 'none') {
    reasons.push('commit evidence does not require a release bump')
  } else {
    reasons.push(`commit evidence requires a ${level} release bump`)
  }

  return Object.freeze({
    level,
    reasons: Object.freeze(reasons),
    warnings: Object.freeze(warnings),
  })
}

export function classifyProtocol(signals) {
  const reasons = ['protocol levels require explicit operator intent']
  const warnings = []
  if (signals.protocolSurfaceChanged) {
    const files = signals.protocolFiles?.join(', ') || 'src/protocol/'
    warnings.push(
      `protocol surface changed (${files}); decide with explicit --protocol`,
    )
  }

  return Object.freeze({
    level: 'none',
    reasons: Object.freeze(reasons),
    warnings: Object.freeze(warnings),
  })
}

export function validateReleaseOverride(proposed, override, force) {
  if (!(proposed in RANK) || !(override in RANK)) {
    throw new Error('release override validation requires valid semver levels')
  }
  if (!force && RANK[override] < RANK[proposed]) {
    return Object.freeze({
      ok: false,
      level: proposed,
      message: `release override ${override} undercuts ${proposed} commit evidence`,
    })
  }
  return Object.freeze({ ok: true, level: override })
}

export function planBump({ signals, current, overrides, force }) {
  const releaseProposal = classifyRelease(signals)
  const protocolProposal = classifyProtocol(signals)
  const releaseValidation =
    overrides.release === null
      ? { ok: true, level: releaseProposal.level }
      : validateReleaseOverride(releaseProposal.level, overrides.release, force)
  const releaseLevel = releaseValidation.ok
    ? releaseValidation.level
    : releaseProposal.level
  const protocolLevel = overrides.protocol ?? protocolProposal.level
  const violations = releaseValidation.ok ? [] : [releaseValidation.message]

  const release = Object.freeze({
    level: releaseLevel,
    current: current.release,
    next: bumpRelease(current.release, releaseLevel),
    reasons: releaseProposal.reasons,
    warnings: releaseProposal.warnings,
  })
  const protocol = Object.freeze({
    level: protocolLevel,
    current: current.protocol,
    next: bumpProtocol(current.protocol, protocolLevel),
    reasons: protocolProposal.reasons,
    warnings: protocolProposal.warnings,
  })

  return Object.freeze({
    release,
    protocol,
    warnings: Object.freeze([
      ...releaseProposal.warnings,
      ...protocolProposal.warnings,
    ]),
    violations: Object.freeze(violations),
  })
}
