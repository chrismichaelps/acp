import { describe, expect, it } from 'vitest'
import { cleanupMergedMarker } from './acp-docker-gh-sandbox-support.mjs'

const pr = {
  ref: 'o/r#2',
  number: 2,
  branch: 'acp-sandbox/run-1',
  path: 'sandbox/run-1.md',
  created: true,
}

const scripted = (results) => {
  const calls = []
  let index = 0
  const run = async (args) => {
    calls.push(args)
    const result = results.at(index)
    index += 1
    if (result === undefined) throw new Error('unexpected gh call')
    return result
  }
  return { run, calls }
}

const ok = (stdout = '') => ({ ok: true, code: 0, stdout, stderr: '' })
const missing = () => ({
  ok: false,
  code: 1,
  stdout: '',
  stderr: 'gh: Not Found (HTTP 404)',
})

describe('GitHub sandbox merged-marker cleanup', () => {
  it('deletes only the merged marker from the default branch', async () => {
    const { run, calls } = scripted([
      ok('FILE_SHA\n'),
      ok('main\n'),
      ok('{}'),
      missing(),
    ])

    await expect(cleanupMergedMarker('o/r', pr, run)).resolves.toBe(true)
    expect(calls[2]).toEqual(
      expect.arrayContaining([
        'DELETE',
        'repos/o/r/contents/sandbox/run-1.md',
        'sha=FILE_SHA',
        'branch=main',
      ]),
    )
  })

  it('is idempotent when the merged marker is already absent', async () => {
    const { run, calls } = scripted([missing()])

    await expect(cleanupMergedMarker('o/r', pr, run)).resolves.toBe(false)
    expect(calls).toHaveLength(1)
  })

  it('refuses to delete a path outside the sandbox marker namespace', async () => {
    const { run, calls } = scripted([])

    await expect(
      cleanupMergedMarker('o/r', { ...pr, path: 'README.md' }, run),
    ).rejects.toThrow('refusing to delete non-sandbox marker path')
    expect(calls).toHaveLength(0)
  })
})
