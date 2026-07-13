/** @Acp.App.Cli.GhBridge.Test — gh bridge over a live server + fake gateway */
import { NodeHttpClient } from '@effect/platform-node'
import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { makeGitHubGatewayFake } from '../../infrastructure/github/index.js'
import {
  expectOk,
  initAgent,
  onLiveServer,
  plannerPerms,
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

const ghPerms = [
  ...plannerPerms,
  'artifact:create',
  'work:claim',
  'work:update',
  'review:create',
  'review:collaborate',
]

const requestReview = async (
  baseUrl: string,
  planner: { readonly token: string; readonly workerId: string },
  workId: string,
) => {
  await expectOk(
    baseUrl,
    'claim review target',
    ['work', 'claim', workId, '--worker', planner.workerId],
    planner.token,
  )
  await expectOk(
    baseUrl,
    'start review target',
    ['work', 'update', workId, '--state', 'running'],
    planner.token,
  )
  return expectOk(
    baseUrl,
    'request review target',
    ['review', 'request', '--work', workId, '--by', planner.workerId],
    planner.token,
  )
}

describe('acp gh import', () => {
  it('imports the PR diff as diff + pull_request artifacts', async () => {
    await onLiveServer(async (baseUrl) => {
      const planner = await initAgent(baseUrl, 'ghtest', 'planner', ghPerms, [
        'supports_checkpoints',
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
        ['work', 'create', 'Import target', '--workspace', ws.id as string],
        planner.token,
      )
      const fake = makeGitHubGatewayFake(seed)
      process.env.ACP_BASE_URL = baseUrl
      process.env.ACP_RPC_TOKEN = planner.token
      await Effect.runPromise(
        runGhBridge([
          'gh',
          'import',
          'o/r#7',
          '--work',
          work.id as string,
          '--workspace',
          ws.id as string,
        ]).pipe(
          Effect.provide(Layer.mergeAll(fake.layer, NodeHttpClient.layer)),
        ),
      )
      const artifacts = (await expectOk(
        baseUrl,
        'artifacts',
        ['artifact', 'list', '--work', work.id as string],
        planner.token,
      )) as unknown as { kind: string }[]
      const kinds = artifacts.map((a) => a.kind).sort()
      expect(kinds).toEqual(['diff', 'pull_request'])
    })
  })
})

describe('acp gh sync (one-way)', () => {
  it('posts ACP comments to GitHub and stamps external_id', async () => {
    await onLiveServer(async (baseUrl) => {
      const planner = await initAgent(baseUrl, 'ghsync', 'planner', ghPerms, [
        'supports_checkpoints',
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
        ['work', 'create', 'Sync target', '--workspace', ws.id as string],
        planner.token,
      )
      const review = await requestReview(baseUrl, planner, work.id as string)

      const reviewId = review.id as string
      await expectOk(
        baseUrl,
        'comment 1',
        [
          'review',
          'comment',
          '--review',
          reviewId,
          '--work',
          work.id as string,
          '--workspace',
          ws.id as string,
          '--artifact',
          'artifact_diff_1',
          '--file',
          'src/app.ts',
          '--side',
          'new',
          '--body',
          'First ACP comment.',
        ],
        planner.token,
      )
      await expectOk(
        baseUrl,
        'comment 2',
        [
          'review',
          'comment',
          '--review',
          reviewId,
          '--work',
          work.id as string,
          '--workspace',
          ws.id as string,
          '--artifact',
          'artifact_diff_1',
          '--file',
          'src/other.ts',
          '--side',
          'old',
          '--body',
          'Second ACP comment.',
        ],
        planner.token,
      )

      const fake = makeGitHubGatewayFake(seed)
      process.env.ACP_BASE_URL = baseUrl
      process.env.ACP_RPC_TOKEN = planner.token
      await Effect.runPromise(
        runGhBridge([
          'gh',
          'sync',
          'o/r#7',
          '--work',
          work.id as string,
          '--review',
          reviewId,
          '--artifact',
          'artifact_diff_1',
        ]).pipe(
          Effect.provide(Layer.mergeAll(fake.layer, NodeHttpClient.layer)),
        ),
      )

      expect(fake.state.postedComments).toHaveLength(2)

      const listed = (await expectOk(
        baseUrl,
        'comment list',
        ['review', 'comment', 'list', '--work', work.id as string],
        planner.token,
      )) as unknown as { external_id: string | null }[]
      expect(listed).toHaveLength(2)
      for (const comment of listed) {
        expect(comment.external_id).not.toBeNull()
      }
    })
  })
})

describe('acp gh sync (bidirectional reconcile)', () => {
  const seedWithGhComment = {
    ...seed,
    comments: [
      {
        id: 'gh_1',
        path: 'src/imported.ts',
        line: 12,
        side: 'RIGHT' as const,
        body: 'GitHub reviewer remark.',
        author: 'octocat',
        in_reply_to: null,
        resolved: false,
      },
    ],
  }

  const setUpSyncFixture = async (baseUrl: string, agentName: string) => {
    const planner = await initAgent(baseUrl, agentName, 'planner', ghPerms, [
      'supports_checkpoints',
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
      ['work', 'create', 'Reconcile target', '--workspace', ws.id as string],
      planner.token,
    )
    const review = await requestReview(baseUrl, planner, work.id as string)
    return { planner, review, ws, work }
  }

  const syncArgv = (prWorkId: string, reviewId: string): readonly string[] => [
    'gh',
    'sync',
    'o/r#7',
    '--work',
    prWorkId,
    '--review',
    reviewId,
    '--artifact',
    'artifact_diff_1',
  ]

  it('imports unseen GitHub comments into ACP with provenance', async () => {
    await onLiveServer(async (baseUrl) => {
      const { planner, review, work } = await setUpSyncFixture(
        baseUrl,
        'ghrecon1',
      )
      const fake = makeGitHubGatewayFake(seedWithGhComment)
      process.env.ACP_BASE_URL = baseUrl
      process.env.ACP_RPC_TOKEN = planner.token

      await Effect.runPromise(
        runGhBridge(syncArgv(work.id as string, review.id as string)).pipe(
          Effect.provide(Layer.mergeAll(fake.layer, NodeHttpClient.layer)),
        ),
      )

      const listed = (await expectOk(
        baseUrl,
        'comment list',
        ['review', 'comment', 'list', '--work', work.id as string],
        planner.token,
      )) as unknown as { origin: string; external_id: string | null }[]

      expect(listed).toHaveLength(1)
      expect(listed[0].origin).toBe('github')
      expect(listed[0].external_id).toBe('gh_1')
    })
  })

  it('is idempotent across repeated syncs', async () => {
    await onLiveServer(async (baseUrl) => {
      const { planner, review, work } = await setUpSyncFixture(
        baseUrl,
        'ghrecon2',
      )
      const fake = makeGitHubGatewayFake(seedWithGhComment)
      process.env.ACP_BASE_URL = baseUrl
      process.env.ACP_RPC_TOKEN = planner.token

      const runSync = () =>
        Effect.runPromise(
          runGhBridge(syncArgv(work.id as string, review.id as string)).pipe(
            Effect.provide(Layer.mergeAll(fake.layer, NodeHttpClient.layer)),
          ),
        )

      await runSync()
      const afterFirst = (await expectOk(
        baseUrl,
        'comment list',
        ['review', 'comment', 'list', '--work', work.id as string],
        planner.token,
      )) as unknown as unknown[]

      await runSync()
      const afterSecond = (await expectOk(
        baseUrl,
        'comment list',
        ['review', 'comment', 'list', '--work', work.id as string],
        planner.token,
      )) as unknown as unknown[]

      expect(fake.state.postedComments).toHaveLength(0)
      expect(afterSecond).toHaveLength(afterFirst.length)
    })
  })

  it('never re-posts a stamped ACP comment or re-imports a mirrored GitHub comment', async () => {
    await onLiveServer(async (baseUrl) => {
      const { planner, review, ws, work } = await setUpSyncFixture(
        baseUrl,
        'ghrecon3',
      )

      await expectOk(
        baseUrl,
        'comment',
        [
          'review',
          'comment',
          '--review',
          review.id as string,
          '--work',
          work.id as string,
          '--workspace',
          ws.id as string,
          '--artifact',
          'artifact_diff_1',
          '--file',
          'src/app.ts',
          '--side',
          'new',
          '--body',
          'Loop-guard ACP comment.',
        ],
        planner.token,
      )

      const fake = makeGitHubGatewayFake(seedWithGhComment)
      process.env.ACP_BASE_URL = baseUrl
      process.env.ACP_RPC_TOKEN = planner.token

      const runSync = () =>
        Effect.runPromise(
          runGhBridge(syncArgv(work.id as string, review.id as string)).pipe(
            Effect.provide(Layer.mergeAll(fake.layer, NodeHttpClient.layer)),
          ),
        )

      await runSync()
      await runSync()

      expect(fake.state.postedComments).toHaveLength(1)
      const ids = fake.state.postedComments.map((c) => c.id)
      expect(new Set(ids).size).toBe(ids.length)

      const listed = (await expectOk(
        baseUrl,
        'comment list',
        ['review', 'comment', 'list', '--work', work.id as string],
        planner.token,
      )) as unknown as { origin: string }[]
      const githubOriginCount = listed.filter(
        (c) => c.origin === 'github',
      ).length
      expect(githubOriginCount).toBe(1)
    })
  })

  it('propagates resolved ACP comments to GitHub thread resolution', async () => {
    await onLiveServer(async (baseUrl) => {
      const { planner, review, ws, work } = await setUpSyncFixture(
        baseUrl,
        'ghrecon4',
      )

      const created = await expectOk(
        baseUrl,
        'comment',
        [
          'review',
          'comment',
          '--review',
          review.id as string,
          '--work',
          work.id as string,
          '--workspace',
          ws.id as string,
          '--artifact',
          'artifact_diff_1',
          '--file',
          'src/app.ts',
          '--side',
          'new',
          '--body',
          'Will be resolved.',
        ],
        planner.token,
      )

      const fake = makeGitHubGatewayFake(seed)
      process.env.ACP_BASE_URL = baseUrl
      process.env.ACP_RPC_TOKEN = planner.token

      await Effect.runPromise(
        runGhBridge(syncArgv(work.id as string, review.id as string)).pipe(
          Effect.provide(Layer.mergeAll(fake.layer, NodeHttpClient.layer)),
        ),
      )

      await expectOk(
        baseUrl,
        'resolve',
        ['review', 'comment', 'resolve', created.id as string],
        planner.token,
      )

      await Effect.runPromise(
        runGhBridge(syncArgv(work.id as string, review.id as string)).pipe(
          Effect.provide(Layer.mergeAll(fake.layer, NodeHttpClient.layer)),
        ),
      )

      const listed = (await expectOk(
        baseUrl,
        'comment list',
        ['review', 'comment', 'list', '--work', work.id as string],
        planner.token,
      )) as unknown as { external_id: string | null }[]
      const stamped = listed.find((c) => c.external_id !== null)
      expect(stamped).toBeDefined()
      expect(fake.state.resolvedThreads).toContain(stamped?.external_id)
    })
  })
})
