/**
 * @Acp.Infra.GitHub.PureCoreInvariant.Test — the GitHub bridge is edge-only.
 *
 * The domain core and the main server layer must never depend on the GitHub
 * infrastructure or spawn `gh`. GitHub I/O is composed only into the CLI bridge
 * runner. This test fails if any domain/server-layer file leaks the dependency.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const readSource = (path: string): string => readFileSync(path, 'utf8')

const walkTs = (dir: string): readonly string[] => {
  const entries = readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return walkTs(full)
    return entry.isFile() && entry.name.endsWith('.ts') ? [full] : []
  })
}

// Forbidden references: the github infra barrel/modules, a spawned `gh `, and
// the Node subprocess module (a domain/server file must never shell out).
const FORBIDDEN: readonly {
  readonly label: string
  readonly needle: string
}[] = [
  { label: 'github infrastructure import', needle: 'infrastructure/github' },
  { label: 'node child_process', needle: 'child_process' },
  { label: 'spawned gh command', needle: '`gh ' },
]

const GUARDED_FILES = ['src/app/app-live.ts', 'src/app/server/http-app.ts']

describe('GitHub bridge pure-core invariant', () => {
  it('keeps the domain core and main server layer free of GitHub I/O', () => {
    const domainFiles = walkTs('src/domain').filter(
      (f) => !f.endsWith('.test.ts'),
    )
    const files = [...GUARDED_FILES, ...domainFiles]

    const leaks: string[] = []
    for (const file of files) {
      const source = readSource(file)
      for (const { label, needle } of FORBIDDEN) {
        if (source.includes(needle)) leaks.push(`${file}: ${label}`)
      }
    }

    expect(leaks).toEqual([])
  })
})
