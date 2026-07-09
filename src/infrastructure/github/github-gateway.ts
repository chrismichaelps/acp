/** @Acp.Infra.GitHub.Gateway — GitHub interaction seam (Context.Tag) */
import { Context } from 'effect'
import type { Effect } from 'effect'
import type { GitHubError } from './github-error.js'
import type {
  GitHubReviewComment,
  MergeMethod,
  PostCommentInput,
  PrRef,
  PullRequestRef,
} from './github-types.js'

export interface GitHubGatewayApi {
  readonly fetchPullRequest: (
    ref: PrRef,
  ) => Effect.Effect<PullRequestRef, GitHubError>
  readonly fetchDiff: (ref: PrRef) => Effect.Effect<string, GitHubError>
  readonly listReviewComments: (
    ref: PrRef,
  ) => Effect.Effect<readonly GitHubReviewComment[], GitHubError>
  readonly postReviewComment: (
    ref: PrRef,
    input: PostCommentInput,
  ) => Effect.Effect<GitHubReviewComment, GitHubError>
  readonly resolveReviewThread: (
    ref: PrRef,
    externalId: string,
  ) => Effect.Effect<void, GitHubError>
  readonly postIssueComment: (
    ref: PrRef,
    body: string,
  ) => Effect.Effect<void, GitHubError>
  readonly merge: (
    ref: PrRef,
    method: MergeMethod,
  ) => Effect.Effect<void, GitHubError>
}

export class GitHubGateway extends Context.Tag('GitHubGateway')<
  GitHubGateway,
  GitHubGatewayApi
>() {}
