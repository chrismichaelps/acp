import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DIST_MAIN,
  ensureHostCli,
  expectedFirstSyncCommentCount,
  requireSandboxRepo,
  writeSandboxMarker,
} from './acp-docker-gh-sandbox-support.mjs'

const originalSkipBuild = process.env.ACP_GH_SANDBOX_SKIP_BUILD
const originalSandboxRepo = process.env.ACP_GH_SANDBOX_REPO

afterEach(() => {
  if (originalSkipBuild === undefined) {
    delete process.env.ACP_GH_SANDBOX_SKIP_BUILD
  } else {
    process.env.ACP_GH_SANDBOX_SKIP_BUILD = originalSkipBuild
  }
  if (originalSandboxRepo === undefined) {
    delete process.env.ACP_GH_SANDBOX_REPO
  } else {
    process.env.ACP_GH_SANDBOX_REPO = originalSandboxRepo
  }
})

describe('GitHub sandbox support', () => {
  it('fails closed before work when no sandbox target is configured', () => {
    delete process.env.ACP_GH_SANDBOX_REPO

    expect(() => requireSandboxRepo()).toThrow(
      'ACP_GH_SANDBOX_REPO must be set',
    )
  })

  it('rebuilds the host CLI even when dist already exists', async () => {
    delete process.env.ACP_GH_SANDBOX_SKIP_BUILD
    const calls = []

    await ensureHostCli({
      exists: () => true,
      run: async (command, args, options) => {
        calls.push({ command, args, options })
        return { ok: true, code: 0, stdout: '', stderr: '' }
      },
    })

    expect(calls).toEqual([
      {
        command: 'node',
        args: ['--run', 'build'],
        options: { timeoutMs: 600_000 },
      },
    ])
  })

  it('fails early when build reuse has no CLI entrypoint', async () => {
    process.env.ACP_GH_SANDBOX_SKIP_BUILD = 'true'

    await expect(
      ensureHostCli({
        exists: () => false,
        run: async () => ({ ok: true, code: 0, stdout: '', stderr: '' }),
      }),
    ).rejects.toThrow(`requires existing ${DIST_MAIN}`)
  })

  it('creates parent directories for the sandbox marker', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'acp-sandbox-support-'))
    try {
      await writeSandboxMarker(directory, 'sandbox/run-1.md', 'run-1')

      await expect(
        readFile(join(directory, 'sandbox/run-1.md'), 'utf8'),
      ).resolves.toContain('# ACP sandbox run-1')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('preserves a retained PR comment baseline in sync expectations', () => {
    expect(expectedFirstSyncCommentCount(4, 1)).toBe(6)
  })
})
