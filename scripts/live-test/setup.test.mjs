import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const setup = (base, runId) =>
  JSON.parse(
    execFileSync('node', ['scripts/live-test/setup.mjs', runId], {
      encoding: 'utf8',
      env: { ...process.env, ACP_LIVE_TEST_DIR: base },
    }),
  )

describe('live-agent fixture setup', () => {
  it('creates an executable two-task fixture without erasing rerun edits', () => {
    const base = mkdtempSync(join(tmpdir(), 'acp-live-setup-test-'))
    try {
      const first = setup(base, 'fixture')
      expect(first.WORK_REPO).toBe(join(base, 'fixture', 'work-repo'))
      expect(() =>
        execFileSync('node', ['test.mjs'], {
          cwd: first.WORK_REPO,
          stdio: 'pipe',
        }),
      ).toThrow()

      const utilA = join(first.WORK_REPO, 'src/util-a.js')
      writeFileSync(utilA, 'export function add(a, b) {\n  return a + b\n}\n')
      setup(base, 'fixture')

      expect(readFileSync(utilA, 'utf8')).toContain('return a + b')
      expect(
        readFileSync(join(first.WORK_REPO, 'src/shared.js'), 'utf8'),
      ).toContain('CONTENTION_PROBE')
      expect(readFileSync(join(first.WORK_REPO, 'test.mjs'), 'utf8')).toContain(
        "helpers.capitalize('agent')",
      )
    } finally {
      rmSync(base, { recursive: true, force: true })
    }
  })

  it('ships parseable structured result schemas', () => {
    for (const name of ['planner', 'worker', 'reviewer']) {
      const schema = JSON.parse(
        readFileSync(
          join('scripts/live-test/schemas', `${name}-result.schema.json`),
          'utf8',
        ),
      )
      expect(schema.type).toBe('object')
      expect(schema.additionalProperties).toBe(false)
      expect(schema.required.length).toBeGreaterThan(0)
    }
  })
})
