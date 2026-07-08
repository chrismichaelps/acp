/** @Acp.Infra.GitHub.GatewayFake — in-memory scripted GitHubGateway double for tests */
import { Effect, Layer } from 'effect'
import { GitHubGateway } from './github-gateway.js'
import type {
  GitHubReviewComment,
  MergeMethod,
  PostCommentInput,
  PrRef,
  PullRequestRef,
} from './github-types.js'

export interface FakeSeed {
  readonly pull: PullRequestRef
  readonly diff: string
  readonly comments: readonly GitHubReviewComment[]
}

export interface FakeState {
  readonly postedComments: GitHubReviewComment[]
  readonly resolvedThreads: unknown[]
  readonly issueComments: unknown[]
  readonly merged: unknown[]
}

export interface GitHubGatewayFake {
  readonly layer: Layer.Layer<GitHubGateway>
  readonly state: FakeState
}

export const makeGitHubGatewayFake = (seed: FakeSeed): GitHubGatewayFake => {
  const comments: GitHubReviewComment[] = [...seed.comments]

  const state: FakeState = {
    postedComments: [],
    resolvedThreads: [],
    issueComments: [],
    merged: [],
  }

  let nextId = 1

  const fetchPullRequest = (_ref: PrRef) => Effect.succeed(seed.pull)

  const fetchDiff = (_ref: PrRef) => Effect.succeed(seed.diff)

  const listReviewComments = (_ref: PrRef) => Effect.succeed([...comments])

  const postReviewComment = (_ref: PrRef, input: PostCommentInput) =>
    Effect.sync(() => {
      const created: GitHubReviewComment = {
        id: `gh_c_${String(nextId)}`,
        path: input.path,
        line: input.line,
        side: input.side,
        body: input.body,
        author: 'acp',
        in_reply_to: null,
        resolved: false,
      }
      nextId += 1
      comments.push(created)
      state.postedComments.push(created)
      return created
    })

  const resolveReviewThread = (ref: PrRef, externalId: string) =>
    Effect.sync(() => {
      state.resolvedThreads.push(externalId)
      void ref
    })

  const postIssueComment = (ref: PrRef, body: string) =>
    Effect.sync(() => {
      state.issueComments.push(body)
      void ref
    })

  const merge = (ref: PrRef, method: MergeMethod) =>
    Effect.sync(() => {
      state.merged.push({ ref, method })
    })

  const layer = Layer.succeed(GitHubGateway, {
    fetchPullRequest,
    fetchDiff,
    listReviewComments,
    postReviewComment,
    resolveReviewThread,
    postIssueComment,
    merge,
  })

  return { layer, state }
}
