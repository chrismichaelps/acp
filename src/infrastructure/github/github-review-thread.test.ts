/** @Acp.Infra.GitHub.ReviewThread.Test — thread lookup regressions */
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { GitHubError } from './github-error.js'
import { makeReviewThreadResolver } from './github-review-thread.js'

const ref = { owner: 'o', repo: 'r', number: 7 }

const response = (
  nodes: readonly {
    readonly id: string
    readonly isResolved: boolean
    readonly databaseIds: readonly number[]
  }[],
  pageInfo = { hasNextPage: false, endCursor: null as string | null },
) =>
  JSON.stringify({
    data: {
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: nodes.map((node) => ({
              id: node.id,
              isResolved: node.isResolved,
              comments: {
                nodes: node.databaseIds.map((databaseId) => ({ databaseId })),
              },
            })),
            pageInfo,
          },
        },
      },
    },
  })

const scripted = (outputs: readonly string[]) => {
  const calls: string[][] = []
  let index = 0
  const run = (args: readonly string[]) => {
    calls.push([...args])
    const output = outputs.at(index)
    index += 1
    return output === undefined
      ? Effect.fail(
          new GitHubError({ command: 'test', stderr: 'unexpected call' }),
        )
      : Effect.succeed(output)
  }
  return { run, calls }
}

describe('makeReviewThreadResolver', () => {
  it('finds the thread containing a REST comment database id', async () => {
    const { run } = scripted([
      response([{ id: 'THREAD_1', isResolved: false, databaseIds: [55] }]),
    ])

    await expect(
      Effect.runPromise(makeReviewThreadResolver(run)(ref, '55')),
    ).resolves.toEqual({ id: 'THREAD_1', isResolved: false })
  })

  it('follows review-thread pagination', async () => {
    const { run, calls } = scripted([
      response([], { hasNextPage: true, endCursor: 'CURSOR_1' }),
      response([{ id: 'THREAD_2', isResolved: false, databaseIds: [55] }]),
    ])

    const found = await Effect.runPromise(
      makeReviewThreadResolver(run)(ref, '55'),
    )
    expect(found.id).toBe('THREAD_2')
    expect(calls[1]).toContain('cursor=CURSOR_1')
  })

  it('returns an already-resolved thread without changing its state', async () => {
    const { run } = scripted([
      response([{ id: 'THREAD_1', isResolved: true, databaseIds: [55] }]),
    ])

    await expect(
      Effect.runPromise(makeReviewThreadResolver(run)(ref, '55')),
    ).resolves.toEqual({ id: 'THREAD_1', isResolved: true })
  })

  it('rejects an invalid REST comment id before calling GitHub', async () => {
    const { run, calls } = scripted([])

    const exit = await Effect.runPromiseExit(
      makeReviewThreadResolver(run)(ref, 'THREAD_ID'),
    )
    expect(exit._tag).toBe('Failure')
    expect(calls).toHaveLength(0)
  })

  it('maps malformed GraphQL JSON into GitHubError', async () => {
    const { run } = scripted(['not-json'])

    const exit = await Effect.runPromiseExit(
      makeReviewThreadResolver(run)(ref, '55'),
    )
    expect(exit._tag).toBe('Failure')
  })

  it('fails after exhausting pages without the target thread', async () => {
    const { run } = scripted([response([])])

    const exit = await Effect.runPromiseExit(
      makeReviewThreadResolver(run)(ref, '55'),
    )
    expect(exit._tag).toBe('Failure')
  })
})
