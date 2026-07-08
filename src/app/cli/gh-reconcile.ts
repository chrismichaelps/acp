/** @Acp.App.Cli.GhReconcile — GitHub<->ACP review-comment reconcile helpers */
import type { GitHubReviewComment } from '../../infrastructure/github/index.js'

export interface WireCommentTarget {
  readonly file: string
  readonly line: number | null
  readonly side: string
}

export interface WireComment {
  readonly id: string
  readonly origin: string
  readonly external_id: string | null | undefined
  readonly state: string
  readonly body: string
  readonly target: WireCommentTarget
}

export const toGitHubSide = (side: string): 'LEFT' | 'RIGHT' =>
  side === 'old' ? 'LEFT' : 'RIGHT'

export const toAcpSide = (side: 'LEFT' | 'RIGHT'): 'old' | 'new' =>
  side === 'LEFT' ? 'old' : 'new'

const hasExternalId = (comment: WireComment): boolean =>
  comment.external_id !== null && comment.external_id !== undefined

export const acpCommentsAwaitingGithubPost = (
  comments: readonly WireComment[],
): readonly WireComment[] =>
  comments.filter((c) => c.origin === 'acp' && !hasExternalId(c))

export const acpCommentsAwaitingResolvePropagation = (
  comments: readonly WireComment[],
): readonly WireComment[] =>
  comments.filter((c) => c.state === 'resolved' && hasExternalId(c))

export const buildExternalIdIndex = (
  comments: readonly WireComment[],
): ReadonlySet<string> => {
  const index = new Set<string>()
  for (const comment of comments) {
    const { external_id } = comment
    if (external_id !== null && external_id !== undefined) {
      index.add(external_id)
    }
  }
  return index
}

export const githubCommentsAwaitingAcpImport = (
  githubComments: readonly GitHubReviewComment[],
  mirroredExternalIds: ReadonlySet<string>,
): readonly GitHubReviewComment[] =>
  githubComments.filter((c) => !mirroredExternalIds.has(c.id))

export interface AcpImportTarget {
  readonly review_id: string
  readonly work_id: string
  readonly workspace_id: string
  readonly artifact_id: string
}

export const toAcpImportPayload = (
  ghComment: GitHubReviewComment,
  target: AcpImportTarget,
): Record<string, unknown> => ({
  review_id: target.review_id,
  work_id: target.work_id,
  workspace_id: target.workspace_id,
  target: {
    artifact_id: target.artifact_id,
    file: ghComment.path,
    side: toAcpSide(ghComment.side),
    ...(ghComment.line === null ? {} : { line: ghComment.line }),
  },
  body: ghComment.body,
  origin: 'github',
  external_id: ghComment.id,
})
