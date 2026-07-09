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

/** Merge-gate evaluation from a work's resume packet (wire form). */
export interface WireReview {
  readonly state: string
}

export interface WireGrill {
  readonly state: string
}

export interface WireResume {
  readonly reviews: readonly WireReview[]
  readonly open_comments: readonly unknown[]
  readonly latest_grill: WireGrill | null | undefined
}

export interface MergeGate {
  readonly ok: boolean
  readonly reasons: readonly string[]
}

const isApproved = (resume: WireResume): boolean =>
  resume.reviews.some((review) => review.state === 'approved')

const isGrillPassed = (resume: WireResume): boolean =>
  resume.latest_grill?.state === 'passed'

/**
 * Read-only gate: merge is allowed only when a review is approved, the latest
 * grill passed, and no review comments remain open. Never mutates ACP state.
 */
export const evaluateMergeGate = (resume: WireResume): MergeGate => {
  const reasons: string[] = []
  if (!isApproved(resume)) reasons.push('review not approved')
  if (!isGrillPassed(resume)) reasons.push('grill not passed')
  const openCount = resume.open_comments.length
  if (openCount > 0) reasons.push(`${String(openCount)} unresolved comment(s)`)
  return { ok: reasons.length === 0, reasons }
}

/** One-line decision summary posted to the PR as an issue comment. */
export const formatDecision = (resume: WireResume): string => {
  const grillWord = resume.latest_grill?.state ?? 'none'
  const reviewWord = isApproved(resume)
    ? 'approved'
    : resume.reviews.length === 0
      ? 'none'
      : resume.reviews[resume.reviews.length - 1].state
  const openWord = `${String(resume.open_comments.length)} unresolved`
  return `ACP gate — review: ${reviewWord}, grill: ${grillWord}, ${openWord}`
}
