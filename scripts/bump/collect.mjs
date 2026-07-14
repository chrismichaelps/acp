// @Acp.Scripts.Bump.Collect — reachable baseline and repository evidence adapter

import { execFileSync } from 'node:child_process'
import { parseCommitLog } from './parse-commits.mjs'

export function createGitRunner({ cwd = process.cwd() } = {}) {
  return (args, { allowFailure = false } = {}) => {
    try {
      return execFileSync('git', args, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (error) {
      if (allowFailure) return null
      const detail = error.stderr?.toString().trim() || error.message
      throw new Error(`git ${args[0]} failed: ${detail}`, { cause: error })
    }
  }
}

function resolveCommit(ref, git) {
  try {
    return git(['rev-parse', '--verify', `${ref}^{commit}`]).trim()
  } catch (error) {
    throw new Error(`invalid --since ref ${JSON.stringify(ref)}`, {
      cause: error,
    })
  }
}

export function resolveBaseline({ since = null, git }) {
  if (typeof git !== 'function') {
    throw new TypeError('resolveBaseline requires a git runner')
  }
  if (since !== null) {
    return Object.freeze({
      ref: since,
      commit: resolveCommit(since, git),
      source: 'explicit',
    })
  }

  const tag = git(
    ['describe', '--tags', '--match', 'v[0-9]*', '--abbrev=0', 'HEAD'],
    { allowFailure: true },
  )?.trim()
  if (!tag) {
    throw new Error(
      'no reachable release tag; use --since <ref> or establish --baseline',
    )
  }

  return Object.freeze({
    ref: tag,
    commit: git(['rev-parse', '--verify', `${tag}^{commit}`]).trim(),
    source: 'tag',
  })
}

export function collectSignals({ baseline, git }) {
  if (!baseline?.ref || typeof git !== 'function') {
    throw new TypeError('collectSignals requires a baseline ref and git runner')
  }

  const range = `${baseline.ref}..HEAD`
  const commits = parseCommitLog(git(['log', range, '--format=%x1e%s%x1f%b']))
  const changedFiles = git(['diff', '--name-only', '-z', range])
    .split('\u0000')
    .filter(Boolean)
  const protocolFiles = changedFiles.filter((path) =>
    path.startsWith('src/protocol/'),
  )

  return Object.freeze({
    commits,
    changedFiles: Object.freeze(changedFiles),
    protocolSurfaceChanged: protocolFiles.length > 0,
    protocolFiles: Object.freeze(protocolFiles),
  })
}
