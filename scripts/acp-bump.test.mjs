// @Acp.Scripts.AcpBump.Test — isolated repository version bump integration
import { execFileSync, spawnSync } from 'node:child_process'
import {
  appendFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { runVersionBump } from './acp-bump.mjs'

const script = fileURLToPath(new URL('./acp-bump.mjs', import.meta.url))
const temporaryDirectories = []

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trimEnd()
}

function write(cwd, path, content) {
  const target = join(cwd, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
}

function createRepository({ baseline = false } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'acp-bump-cli-'))
  temporaryDirectories.push(cwd)
  git(cwd, 'init', '--quiet')
  git(cwd, 'config', 'user.name', 'ACP Test')
  git(cwd, 'config', 'user.email', 'acp@example.test')
  write(
    cwd,
    'package.json',
    '{\n  "name": "acp-fixture",\n  "version": "1.0.0"\n}\n',
  )
  write(
    cwd,
    'src/protocol/version.ts',
    "/** fixture */\nexport const ACP_PROTOCOL_VERSION = '0.1' as const\n",
  )
  write(
    cwd,
    'wiki/CHANGELOG.md',
    '# Changelog\n\nTemporal ledger.\n\n- 2026-07-12 · initial\n',
  )
  write(cwd, 'README.md', '# Fixture\n')
  git(cwd, 'add', '.')
  git(cwd, 'commit', '--quiet', '-m', 'chore: initial')
  if (baseline) git(cwd, 'tag', '-a', 'v1.0.0', '-m', 'baseline')
  return cwd
}

function commitChange(cwd, subject, body = null) {
  appendFileSync(join(cwd, 'README.md'), `\n${subject}\n`)
  git(cwd, 'add', 'README.md')
  const args = ['commit', '--quiet', '-m', subject]
  if (body !== null) args.push('-m', body)
  git(cwd, ...args)
}

function run(cwd, args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, TZ: 'UTC' },
  })
}

function silentOutput() {
  return { isTTY: false, write: () => true }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true })
  }
})

describe('baseline mode', () => {
  it('previews without mutation and creates an annotated tag with --yes', () => {
    const cwd = createRepository()
    const head = git(cwd, 'rev-parse', 'HEAD')

    const preview = run(cwd, ['--baseline', '--dry-run'])
    expect(preview.status).toBe(0)
    expect(preview.stdout).toMatch(/baseline v1\.0\.0/)
    expect(git(cwd, 'tag', '--list')).toBe('')
    expect(git(cwd, 'rev-parse', 'HEAD')).toBe(head)

    const applied = run(cwd, ['--baseline', '--yes'])
    expect(applied.status).toBe(0)
    expect(git(cwd, 'cat-file', '-t', 'v1.0.0')).toBe('tag')
    expect(git(cwd, 'rev-list', '-n', '1', 'v1.0.0')).toBe(head)
  })

  it('refuses an existing baseline tag', () => {
    const cwd = createRepository({ baseline: true })
    const result = run(cwd, ['--baseline', '--yes'])
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/already exists/)
  })

  it('refuses when HEAD changes during confirmation', async () => {
    const cwd = createRepository()
    const initialHead = git(cwd, 'rev-parse', 'HEAD')

    await expect(
      runVersionBump(['--baseline', '--yes'], {
        cwd,
        output: silentOutput(),
        confirm: async () => {
          commitChange(cwd, 'chore: concurrent baseline change')
          return true
        },
      }),
    ).rejects.toThrow(/HEAD changed during confirmation/)
    expect(git(cwd, 'tag', '--list')).toBe('')
    expect(git(cwd, 'rev-parse', 'HEAD')).not.toBe(initialHead)
  })
})

describe('bump planning and apply', () => {
  it('refuses inference without a baseline', () => {
    const cwd = createRepository()
    const result = run(cwd, ['--dry-run'])
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/no reachable release tag/)
  })

  it('uses full commit-body breaking evidence in a read-only dry run', () => {
    const cwd = createRepository({ baseline: true })
    commitChange(
      cwd,
      'fix: preserve compatibility',
      'BREAKING CHANGE: remove the legacy contract',
    )
    const before = readFileSync(join(cwd, 'package.json'), 'utf8')

    const result = run(cwd, ['--dry-run'])
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/release: 1\.0\.0 → 2\.0\.0 \(major\)/)
    expect(result.stdout).toMatch(/--- package\.json/)
    expect(readFileSync(join(cwd, 'package.json'), 'utf8')).toBe(before)
    expect(git(cwd, 'status', '--porcelain')).toBe('')
  })

  it('refuses an interrupted implicit tag flow that would double-bump', () => {
    const cwd = createRepository({ baseline: true })
    const packagePath = join(cwd, 'package.json')
    writeFileSync(
      packagePath,
      readFileSync(packagePath, 'utf8').replace('1.0.0', '1.1.0'),
    )
    git(cwd, 'add', 'package.json')
    git(cwd, 'commit', '--quiet', '-m', 'chore: record release version')

    const result = run(cwd, ['--dry-run'])
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(
      /package version 1\.1\.0 does not match implicit baseline v1\.0\.0/,
    )

    const explicit = run(cwd, ['--since', 'v1.0.0', '--dry-run'])
    expect(explicit.status).toBe(0)
  })

  it('applies a release bump without tagging the pre-bump commit', () => {
    const cwd = createRepository({ baseline: true })
    commitChange(cwd, 'feat: add a production capability')

    const result = run(cwd, ['--yes'])
    expect(result.status).toBe(0)
    expect(
      JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).version,
    ).toBe('1.1.0')
    expect(
      readFileSync(join(cwd, 'src/protocol/version.ts'), 'utf8'),
    ).toContain("ACP_PROTOCOL_VERSION = '0.1'")
    expect(readFileSync(join(cwd, 'wiki/CHANGELOG.md'), 'utf8')).toMatch(
      /release 1\.0\.0 → 1\.1\.0/,
    )
    expect(git(cwd, 'tag', '--list', 'v1.1.0')).toBe('')
    expect(result.stdout).toMatch(/git tag -a v1\.1\.0/)
  })

  it('applies an explicit protocol bump independently', () => {
    const cwd = createRepository({ baseline: true })
    commitChange(cwd, 'docs: clarify protocol behavior')

    const result = run(cwd, ['--protocol', 'major', '--yes'])
    expect(result.status).toBe(0)
    expect(
      JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).version,
    ).toBe('1.0.0')
    expect(
      readFileSync(join(cwd, 'src/protocol/version.ts'), 'utf8'),
    ).toContain("ACP_PROTOCOL_VERSION = '0.2'")
    expect(result.stdout).not.toMatch(/git tag -a/)
  })

  it('refuses dirty apply but permits a non-mutating dirty preview', () => {
    const cwd = createRepository({ baseline: true })
    commitChange(cwd, 'fix: repair behavior')
    write(cwd, 'untracked.txt', 'operator work\n')

    const preview = run(cwd, ['--dry-run'])
    expect(preview.status).toBe(0)
    expect(preview.stdout).toMatch(/working tree: dirty/)

    const applied = run(cwd, ['--yes'])
    expect(applied.status).toBe(1)
    expect(applied.stderr).toMatch(/working tree is dirty/)
    expect(
      JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).version,
    ).toBe('1.0.0')
  })

  it('fails closed without --yes when no TTY is attached', () => {
    const cwd = createRepository({ baseline: true })
    commitChange(cwd, 'fix: repair behavior')
    const result = run(cwd, [])
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/non-interactive apply requires --yes/)
  })

  it('refuses dirtiness introduced during confirmation', async () => {
    const cwd = createRepository({ baseline: true })
    commitChange(cwd, 'fix: repair behavior')

    await expect(
      runVersionBump(['--yes'], {
        cwd,
        output: silentOutput(),
        confirm: async () => {
          write(cwd, 'concurrent.txt', 'operator work\n')
          return true
        },
      }),
    ).rejects.toThrow(/working tree changed during confirmation/)
    expect(
      JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).version,
    ).toBe('1.0.0')
  })

  it('refuses a clean HEAD change introduced during confirmation', async () => {
    const cwd = createRepository({ baseline: true })
    commitChange(cwd, 'fix: repair behavior')

    await expect(
      runVersionBump(['--yes'], {
        cwd,
        output: silentOutput(),
        confirm: async () => {
          commitChange(cwd, 'chore: concurrent history change')
          return true
        },
      }),
    ).rejects.toThrow(/HEAD changed during confirmation/)
    expect(
      JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).version,
    ).toBe('1.0.0')
  })
})
