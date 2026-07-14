// @Acp.Scripts.Bump.Transaction.Test — atomic multi-file update and rollback
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  TransactionError,
  TransactionRollbackError,
  applyTransaction,
  defaultFileOperations,
} from './transaction.mjs'

const temporaryDirectories = []

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'acp-bump-transaction-'))
  temporaryDirectories.push(directory)
  const first = join(directory, 'first.txt')
  const second = join(directory, 'second.txt')
  writeFileSync(first, 'first-original\n')
  writeFileSync(second, 'second-original\n')
  chmodSync(first, 0o640)
  return { directory, first, second }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true })
  }
})

describe('applyTransaction', () => {
  it('atomically replaces every file and preserves its mode', () => {
    const { first, second } = fixture()
    applyTransaction([
      { path: first, content: 'first-next\n' },
      { path: second, content: 'second-next\n' },
    ])
    expect(readFileSync(first, 'utf8')).toBe('first-next\n')
    expect(readFileSync(second, 'utf8')).toBe('second-next\n')
    expect(statSync(first).mode & 0o777).toBe(0o640)
  })

  it('restores earlier files when a later rename fails', () => {
    const { directory, first, second } = fixture()
    let renames = 0
    const operations = {
      ...defaultFileOperations,
      renameSync(from, to) {
        renames += 1
        if (renames === 2) throw new Error('injected later rename failure')
        defaultFileOperations.renameSync(from, to)
      },
    }

    expect(() =>
      applyTransaction(
        [
          { path: first, content: 'first-next\n' },
          { path: second, content: 'second-next\n' },
        ],
        { operations },
      ),
    ).toThrow(TransactionError)
    expect(readFileSync(first, 'utf8')).toBe('first-original\n')
    expect(readFileSync(second, 'utf8')).toBe('second-original\n')
    expect(
      readdirSync(directory).filter((name) => name.includes('.tmp')),
    ).toEqual([])
  })

  it('reports incomplete rollback distinctly', () => {
    const { first, second } = fixture()
    let renames = 0
    const operations = {
      ...defaultFileOperations,
      renameSync(from, to) {
        renames += 1
        if (renames >= 2) throw new Error(`injected rename failure ${renames}`)
        defaultFileOperations.renameSync(from, to)
      },
    }

    expect(() =>
      applyTransaction(
        [
          { path: first, content: 'first-next\n' },
          { path: second, content: 'second-next\n' },
        ],
        { operations },
      ),
    ).toThrow(TransactionRollbackError)
  })

  it('rejects duplicate targets before mutation', () => {
    const { first } = fixture()
    expect(() =>
      applyTransaction([
        { path: first, content: 'one' },
        { path: first, content: 'two' },
      ]),
    ).toThrow(/duplicate transaction target/)
    expect(readFileSync(first, 'utf8')).toBe('first-original\n')
  })

  it('refuses source drift before creating temporary files', () => {
    const { directory, first } = fixture()
    expect(() =>
      applyTransaction([
        {
          path: first,
          expected: 'stale-planning-snapshot\n',
          content: 'first-next\n',
        },
      ]),
    ).toThrow(/changed after planning/)
    expect(readFileSync(first, 'utf8')).toBe('first-original\n')
    expect(
      readdirSync(directory).filter((name) => name.includes('.tmp')),
    ).toEqual([])
  })
})
