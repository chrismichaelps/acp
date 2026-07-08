/** @Acp.Infra.GitHub.GatewayGh.Test — gh argv + JSON parsing */
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { makeGhGateway } from './github-gateway-gh.js'

const ref = { owner: 'o', repo: 'r', number: 7 }

const fakeRun = (
  script: Record<string, { code: number; stdout: string; stderr: string }>,
) => {
  const calls: string[][] = []
  const run = (_cmd: string, args: readonly string[]) => {
    calls.push([...args])
    const key = args.join(' ')
    const hit = Object.entries(script).find(([k]) => key.includes(k))
    return Effect.succeed(hit ? hit[1] : { code: 0, stdout: '', stderr: '' })
  }
  return { run, calls }
}

describe('makeGhGateway', () => {
  it('fetches a pull request via gh pr view --json', async () => {
    const { run, calls } = fakeRun({
      'pr view': {
        code: 0,
        stdout: JSON.stringify({
          number: 7,
          url: 'u',
          headRefOid: 'h',
          baseRefOid: 'b',
          state: 'OPEN',
          mergeable: 'MERGEABLE',
          title: 't',
        }),
        stderr: '',
      },
    })
    const gh = makeGhGateway(run)
    const pr = await Effect.runPromise(gh.fetchPullRequest(ref))
    expect(pr).toEqual({
      number: 7,
      url: 'u',
      head_sha: 'h',
      base_sha: 'b',
      state: 'OPEN',
      mergeable: true,
      title: 't',
    })
    expect(calls[0]).toContain('--repo')
    expect(calls[0]).toContain('o/r')
  })

  it('fails with GitHubError on a non-zero gh exit', async () => {
    const { run } = fakeRun({
      'pr diff': { code: 1, stdout: '', stderr: 'no auth' },
    })
    const gh = makeGhGateway(run)
    const exit = await Effect.runPromiseExit(gh.fetchDiff(ref))
    expect(exit._tag).toBe('Failure')
  })

  it('merges via gh pr merge with the chosen method', async () => {
    const { run, calls } = fakeRun({
      'pr merge': { code: 0, stdout: '', stderr: '' },
    })
    const gh = makeGhGateway(run)
    await Effect.runPromise(gh.merge(ref, 'squash'))
    expect(calls[0]).toEqual(
      expect.arrayContaining(['pr', 'merge', '7', '--squash', '--repo', 'o/r']),
    )
  })
})
