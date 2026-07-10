/** @Acp.Infra.GitHub.GatewayGh.ReviewThread.Test — resolution orchestration */
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { makeGhGateway } from './github-gateway-gh.js'

const ref = { owner: 'o', repo: 'r', number: 7 }

const threadResponse = (isResolved: boolean) =>
  JSON.stringify({
    data: {
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: [
              {
                id: 'THREAD_NODE',
                isResolved,
                comments: { nodes: [{ databaseId: 55 }] },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    },
  })

const fakeRun = (isResolved: boolean) => {
  const calls: string[][] = []
  const run = (_command: string, args: readonly string[]) => {
    calls.push([...args])
    return Effect.succeed({
      code: 0,
      stdout: args.join(' ').includes('reviewThreads')
        ? threadResponse(isResolved)
        : '{}',
      stderr: '',
    })
  }
  return { run, calls }
}

describe('GitHubGatewayGh review-thread resolution', () => {
  it('looks up a REST comment and mutates with its thread node id', async () => {
    const { run, calls } = fakeRun(false)
    const gh = makeGhGateway(run)

    await Effect.runPromise(gh.resolveReviewThread(ref, '55'))

    expect(calls).toHaveLength(2)
    expect(calls[1]).toContain('threadId=THREAD_NODE')
  })

  it('does not mutate an already-resolved review thread', async () => {
    const { run, calls } = fakeRun(true)
    const gh = makeGhGateway(run)

    await Effect.runPromise(gh.resolveReviewThread(ref, '55'))

    expect(calls).toHaveLength(1)
  })
})
