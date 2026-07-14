// @Acp.Scripts.Bump.Collect.Test — reachable baseline and repository evidence
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { collectSignals, createGitRunner, resolveBaseline } from './collect.mjs'

const temporaryDirectories = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true })
  }
})

describe('resolveBaseline', () => {
  it('verifies and selects an explicit ref', () => {
    const calls = []
    const git = (args) => {
      calls.push(args)
      return 'abc123\n'
    }
    expect(resolveBaseline({ since: 'origin/main', git })).toEqual({
      ref: 'origin/main',
      commit: 'abc123',
      source: 'explicit',
    })
    expect(calls).toEqual([['rev-parse', '--verify', 'origin/main^{commit}']])
  })

  it('selects the newest reachable release tag', () => {
    const git = (args) => (args[0] === 'describe' ? 'v1.4.0\n' : 'deadbeef\n')
    expect(resolveBaseline({ since: null, git })).toEqual({
      ref: 'v1.4.0',
      commit: 'deadbeef',
      source: 'tag',
    })
  })

  it('refuses when no reachable release tag exists', () => {
    const git = (_args, options) => {
      if (options.allowFailure) return null
      throw new Error('unexpected')
    }
    expect(() => resolveBaseline({ since: null, git })).toThrow(/no reachable/)
  })

  it('reports an invalid explicit ref', () => {
    const git = () => {
      throw new Error('bad revision')
    }
    expect(() => resolveBaseline({ since: 'missing', git })).toThrow(
      /invalid --since ref/,
    )
  })
})

describe('collectSignals', () => {
  it('collects full commit evidence and NUL-delimited paths', () => {
    const git = (args) => {
      if (args[0] === 'log') {
        return '\u001efeat(api): add method\u001fDetails\n\nBREAKING CHANGE: old method removed'
      }
      return 'src/protocol/schema/common file.ts\u0000README.md\u0000'
    }
    expect(collectSignals({ baseline: { ref: 'v1.0.0' }, git })).toEqual({
      commits: [
        expect.objectContaining({
          type: 'feat',
          scope: 'api',
          breaking: true,
        }),
      ],
      changedFiles: ['src/protocol/schema/common file.ts', 'README.md'],
      protocolSurfaceChanged: true,
      protocolFiles: ['src/protocol/schema/common file.ts'],
    })
  })

  it('handles empty history and no protocol changes', () => {
    const git = () => ''
    expect(collectSignals({ baseline: { ref: 'HEAD' }, git })).toEqual({
      commits: [],
      changedFiles: [],
      protocolSurfaceChanged: false,
      protocolFiles: [],
    })
  })
})

describe('real Git collection', () => {
  it('ignores an unrelated newer tag and parses a breaking body', () => {
    const directory = mkdtempSync(join(tmpdir(), 'acp-bump-collect-'))
    temporaryDirectories.push(directory)
    const git = (...args) =>
      execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trimEnd()

    git('init', '--quiet')
    git('config', 'user.name', 'ACP Test')
    git('config', 'user.email', 'acp@example.test')
    writeFileSync(join(directory, 'fixture.txt'), 'base\n')
    git('add', 'fixture.txt')
    git('commit', '--quiet', '-m', 'chore: baseline')
    git('tag', '-a', 'v1.0.0', '-m', 'baseline')

    git('checkout', '--quiet', '-b', 'unrelated')
    writeFileSync(join(directory, 'unrelated.txt'), 'other\n')
    git('add', 'unrelated.txt')
    git('commit', '--quiet', '-m', 'feat: unrelated')
    git('tag', '-a', 'v9.0.0', '-m', 'unrelated')
    git('checkout', '--quiet', '-B', 'main', 'v1.0.0')

    writeFileSync(join(directory, 'fixture.txt'), 'changed\n')
    git('add', 'fixture.txt')
    git(
      'commit',
      '--quiet',
      '-m',
      'fix: update fixture',
      '-m',
      'BREAKING CHANGE: fixture contract changed',
    )

    const runner = createGitRunner({ cwd: directory })
    const baseline = resolveBaseline({ since: null, git: runner })
    const signals = collectSignals({ baseline, git: runner })
    expect(baseline.ref).toBe('v1.0.0')
    expect(signals.commits).toEqual([
      expect.objectContaining({ type: 'fix', breaking: true }),
    ])
  })
})
