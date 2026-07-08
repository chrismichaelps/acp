/** @Acp.Infra.PlatformNode.ProcessIO.Test — subprocess runner */
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { runProcess } from './node-process-io.js'

describe('runProcess', () => {
  it('captures stdout and a zero exit code', async () => {
    const result = await Effect.runPromise(
      runProcess('node', ['-e', 'process.stdout.write("hi")']),
    )
    expect(result).toEqual({ code: 0, stdout: 'hi', stderr: '' })
  })

  it('captures a non-zero exit code and stderr without throwing', async () => {
    const result = await Effect.runPromise(
      runProcess('node', [
        '-e',
        'process.stderr.write("boom"); process.exit(3)',
      ]),
    )
    expect(result.code).toBe(3)
    expect(result.stderr).toBe('boom')
  })

  it('reports a spawn failure as code -1', async () => {
    const result = await Effect.runPromise(
      runProcess('acp_no_such_binary_xyz', []),
    )
    expect(result.code).toBe(-1)
    expect(result.stderr.length).toBeGreaterThan(0)
  })

  it('feeds stdin input to the process', async () => {
    const result = await Effect.runPromise(
      runProcess('node', ['-e', 'process.stdin.pipe(process.stdout)'], {
        input: 'echoed',
      }),
    )
    expect(result.stdout).toBe('echoed')
  })
})
