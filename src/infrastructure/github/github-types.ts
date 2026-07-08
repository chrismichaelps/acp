/** @Acp.Infra.GitHub.Types — GitHub bridge value shapes + ref parsing */
import { Either } from 'effect'
import { GitHubError } from './github-error.js'

export type MergeMethod = 'squash' | 'merge' | 'rebase'

export interface PrRef {
  readonly owner: string
  readonly repo: string
  readonly number: number
}

export interface PullRequestRef {
  readonly number: number
  readonly url: string
  readonly head_sha: string
  readonly base_sha: string
  readonly state: string
  readonly mergeable: boolean
  readonly title: string
}

export interface GitHubReviewComment {
  readonly id: string
  readonly path: string
  readonly line: number | null
  readonly side: 'LEFT' | 'RIGHT'
  readonly body: string
  readonly author: string
  readonly in_reply_to: string | null
  readonly resolved: boolean
}

export interface PostCommentInput {
  readonly path: string
  readonly line: number | null
  readonly side: 'LEFT' | 'RIGHT'
  readonly body: string
  readonly commit_id: string
}

const URL_RE = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/
const SHORT_RE = /^([^/]+)\/([^/#]+)#(\d+)$/

export const parsePrRef = (
  input: string,
): Either.Either<PrRef, GitHubError> => {
  const url = URL_RE.exec(input)
  const short = url ? null : SHORT_RE.exec(input)
  const match = url ?? short
  if (match === null) {
    return Either.left(
      new GitHubError({
        command: 'parsePrRef',
        stderr: `unrecognized PR ref: ${input}`,
      }),
    )
  }
  return Either.right({
    owner: match[1],
    repo: match[2],
    number: Number(match[3]),
  })
}
