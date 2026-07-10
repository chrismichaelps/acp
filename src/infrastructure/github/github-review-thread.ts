/** @Acp.Infra.GitHub.ReviewThread — resolves comment thread identity */
import { Effect, Schema } from 'effect'
import { GitHubError } from './github-error.js'
import type { PrRef } from './github-types.js'

export interface GitHubReviewThread {
  readonly id: string
  readonly isResolved: boolean
}

export type RunGhText = (
  args: readonly string[],
) => Effect.Effect<string, GitHubError>

const ThreadComment = Schema.Struct({ databaseId: Schema.Number })
const ReviewThread = Schema.Struct({
  id: Schema.String,
  isResolved: Schema.Boolean,
  comments: Schema.Struct({ nodes: Schema.Array(ThreadComment) }),
})
const ReviewThreads = Schema.Struct({
  nodes: Schema.Array(ReviewThread),
  pageInfo: Schema.Struct({
    hasNextPage: Schema.Boolean,
    endCursor: Schema.NullOr(Schema.String),
  }),
})
const ThreadQueryResponse = Schema.Struct({
  data: Schema.Struct({
    repository: Schema.NullOr(
      Schema.Struct({
        pullRequest: Schema.NullOr(
          Schema.Struct({ reviewThreads: ReviewThreads }),
        ),
      }),
    ),
  }),
})

const reviewThreadsQuery =
  'query($owner:String!,$name:String!,$number:Int!,$cursor:String){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100,after:$cursor){nodes{id isResolved comments(first:100){nodes{databaseId}}}pageInfo{hasNextPage endCursor}}}}}'

const resolverError = (stderr: string) =>
  new GitHubError({ command: 'gh api graphql reviewThreads', stderr })

const decodeResponse = (text: string) =>
  Effect.flatMap(
    Effect.try({
      try: () => JSON.parse(text) as unknown,
      catch: (error) => resolverError(`bad JSON: ${String(error)}`),
    }),
    (value) =>
      Schema.decodeUnknown(ThreadQueryResponse)(value).pipe(
        Effect.mapError((error) =>
          resolverError(`bad reviewThreads response: ${String(error)}`),
        ),
      ),
  )

const queryArgs = (ref: PrRef, cursor: string | null): readonly string[] => [
  'api',
  'graphql',
  '-f',
  `query=${reviewThreadsQuery}`,
  '-f',
  `owner=${ref.owner}`,
  '-f',
  `name=${ref.repo}`,
  '-F',
  `number=${String(ref.number)}`,
  ...(cursor === null ? [] : ['-f', `cursor=${cursor}`]),
]

export const makeReviewThreadResolver =
  (run: RunGhText) =>
  (
    ref: PrRef,
    externalId: string,
  ): Effect.Effect<GitHubReviewThread, GitHubError> => {
    const databaseId = Number(externalId)
    if (!/^[1-9]\d*$/.test(externalId) || !Number.isSafeInteger(databaseId)) {
      return Effect.fail(
        resolverError(`invalid REST comment id: ${externalId}`),
      )
    }

    const find = (
      cursor: string | null,
    ): Effect.Effect<GitHubReviewThread, GitHubError> =>
      Effect.flatMap(run(queryArgs(ref, cursor)), (text) =>
        Effect.flatMap(decodeResponse(text), (response) => {
          const connection =
            response.data.repository?.pullRequest?.reviewThreads
          if (connection === undefined) {
            return Effect.fail(
              resolverError(`pull request not found: ${String(ref.number)}`),
            )
          }
          const thread = connection.nodes.find((candidate) =>
            candidate.comments.nodes.some(
              (comment) => comment.databaseId === databaseId,
            ),
          )
          if (thread !== undefined) {
            return Effect.succeed({
              id: thread.id,
              isResolved: thread.isResolved,
            })
          }
          if (
            connection.pageInfo.hasNextPage &&
            connection.pageInfo.endCursor !== null
          ) {
            return find(connection.pageInfo.endCursor)
          }
          return Effect.fail(
            resolverError(`review thread not found for comment ${externalId}`),
          )
        }),
      )

    return find(null)
  }
