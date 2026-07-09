/** @Acp.App.Cli.GhMerge.Test — gh merge gate over a live server + fake gateway */
import { NodeHttpClient } from '@effect/platform-node'
import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { makeGitHubGatewayFake } from '../../infrastructure/github/index.js'
import {
  driveGrillRound,
  expectOk,
  initAgent,
  onLiveServer,
  plannerPerms,
  reviewerPerms,
  workerPerms,
} from './cli-dogfood-support.js'
import { runGhBridge } from './gh-bridge.js'

const seed = {
  pull: {
    number: 7,
    url: 'https://github.com/o/r/pull/7',
    head_sha: 'h',
    base_sha: 'b',
    state: 'open',
    mergeable: true,
    title: 'PR 7',
  },
  diff: 'diff --git a/x b/x\n+line',
  comments: [],
}

const ghPerms = [...plannerPerms, 'artifact:create']
const artifactId = 'artifact_diff_1'

const mergeArgv = (workId: string): readonly string[] => [
  'gh',
  'merge',
  'o/r#7',
  '--work',
  workId,
]

describe('acp gh merge', () => {
  const setUpAgents = async (baseUrl: string, name: string) => {
    const planner = await initAgent(baseUrl, name, 'planner', ghPerms, [
      'supports_checkpoints',
    ])
    const worker = await initAgent(baseUrl, name, 'worker', workerPerms, [
      'supports_checkpoints',
    ])
    const reviewer = await initAgent(baseUrl, name, 'reviewer', reviewerPerms, [
      'can_review',
    ])
    const ws = await expectOk(
      baseUrl,
      'workspace',
      [
        'workspace',
        'create',
        '--name',
        'o/r',
        '--kind',
        'git_repository',
        '--uri',
        'git+https://github.com/o/r.git',
        '--default-branch',
        'main',
      ],
      planner.token,
    )
    const work = await expectOk(
      baseUrl,
      'work',
      ['work', 'create', 'Merge target', '--workspace', ws.id as string],
      planner.token,
    )
    return { planner, worker, reviewer, ws, work }
  }

  // open -> claimed -> running -> review requested, returning the review.
  const driveToReview = async (
    baseUrl: string,
    worker: { workerId: string; token: string },
    reviewer: { workerId: string },
    workId: string,
  ) => {
    await expectOk(
      baseUrl,
      'work claim',
      ['work', 'claim', workId, '--worker', worker.workerId],
      worker.token,
    )
    await expectOk(
      baseUrl,
      'work running',
      ['work', 'update', workId, '--state', 'running'],
      worker.token,
    )
    return expectOk(
      baseUrl,
      'review request',
      [
        'review',
        'request',
        '--work',
        workId,
        '--by',
        worker.workerId,
        '--reviewer',
        reviewer.workerId,
      ],
      worker.token,
    )
  }

  it('posts the decision comment and merges when the gate is green', async () => {
    await onLiveServer(async (baseUrl) => {
      const { worker, reviewer, ws, work } = await setUpAgents(
        baseUrl,
        'ghmergepass',
      )
      const workId = work.id as string
      const review = await driveToReview(baseUrl, worker, reviewer, workId)
      await driveGrillRound(baseUrl, {
        reviewer,
        worker,
        reviewId: review.id as string,
        workId,
        workspaceId: ws.id as string,
        artifactId,
        accept: true,
        resolveComment: true,
        label: 'pass',
      })
      await expectOk(
        baseUrl,
        'review approve',
        ['review', 'approve', review.id as string, '--met', 'tests_pass'],
        reviewer.token,
      )

      const fake = makeGitHubGatewayFake(seed)
      process.env.ACP_BASE_URL = baseUrl
      process.env.ACP_RPC_TOKEN = worker.token
      await Effect.runPromise(
        runGhBridge(mergeArgv(workId)).pipe(
          Effect.provide(Layer.mergeAll(fake.layer, NodeHttpClient.layer)),
        ),
      )

      expect(fake.state.merged).toHaveLength(1)
      expect(fake.state.merged[0]).toMatchObject({ method: 'squash' })
      const decision = fake.state.issueComments[0] as string
      expect(decision).toContain('passed')
      expect(decision).toContain('0 unresolved')
    })
  })

  it('refuses to merge and fails when the gate is not satisfied', async () => {
    await onLiveServer(async (baseUrl) => {
      const { planner, work } = await setUpAgents(baseUrl, 'ghmergefail')
      const workId = work.id as string

      const fake = makeGitHubGatewayFake(seed)
      process.env.ACP_BASE_URL = baseUrl
      process.env.ACP_RPC_TOKEN = planner.token
      const exit = await Effect.runPromiseExit(
        runGhBridge(mergeArgv(workId)).pipe(
          Effect.provide(Layer.mergeAll(fake.layer, NodeHttpClient.layer)),
        ),
      )

      expect(exit._tag).toBe('Failure')
      expect(fake.state.merged).toHaveLength(0)
    })
  })
})
