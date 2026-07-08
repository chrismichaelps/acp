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

const ghPerms = [...plannerPerms, 'artifact:create']

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

      const reviewId = 'review_sync_1'
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
        runGhBridge(['gh', 'sync', 'o/r#7', '--work', work.id as string]).pipe(
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
