/** @Acp.Infra.GitHub.GatewayFake.Test — scripted gateway double */
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { GitHubGateway } from './github-gateway.js'
import { makeGitHubGatewayFake } from './github-gateway-fake.js'

const seed = {
  pull: {
    number: 7,
    url: 'https://github.com/o/r/pull/7',
    head_sha: 'headsha',
    base_sha: 'basesha',
    state: 'open',
    mergeable: true,
    title: 'PR 7',
  },
  diff: 'diff --git a/x b/x',
  comments: [],
}
const ref = { owner: 'o', repo: 'r', number: 7 }

describe('GitHubGatewayFake', () => {
  it('records a posted comment and reflects it in a later list', async () => {
    const fake = makeGitHubGatewayFake(seed)
    const program = Effect.gen(function* () {
      const gh = yield* GitHubGateway
      const created = yield* gh.postReviewComment(ref, {
        path: 'x',
        line: 1,
        side: 'RIGHT',
        body: 'hi',
        commit_id: 'headsha',
      })
      const listed = yield* gh.listReviewComments(ref)
      return { created, listed }
    })
    const { created, listed } = await Effect.runPromise(
      Effect.provide(program, fake.layer),
    )
    expect(created.id).toBe('gh_c_1')
    expect(listed.map((c) => c.id)).toEqual(['gh_c_1'])
    expect(fake.state.postedComments).toHaveLength(1)
  })

  it('records a merge', async () => {
    const fake = makeGitHubGatewayFake(seed)
    await Effect.runPromise(
      Effect.provide(
        Effect.flatMap(GitHubGateway, (gh) => gh.merge(ref, 'squash')),
        fake.layer,
      ),
    )
    expect(fake.state.merged).toEqual([{ ref, method: 'squash' }])
  })
})
