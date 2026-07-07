/** @Acp.App.Cli.ReviewCommentCommands — review-comment argv parser entries */
import { Either } from 'effect'
import {
  encodePathSegment,
  flag,
  positional,
  type CommandHandler,
} from './command-support.js'

const commentIdCommand =
  (action: 'resolve' | 'reopen'): CommandHandler =>
  ({ positionals }) =>
    Either.map(positional(positionals, 0, 'comment_id'), (commentId) => ({
      method: 'POST' as const,
      path: `/v1/review-comments/${encodePathSegment(commentId)}/${action}`,
      label: `review comment ${action}`,
    }))

export const reviewCommentCommandHandlers: Readonly<
  Record<string, CommandHandler>
> = {
  'review comment': ({ flags }) =>
    Either.gen(function* () {
      const reviewId = yield* flag(flags, 'review')
      const workId = yield* flag(flags, 'work')
      const workspaceId = yield* flag(flags, 'workspace')
      const artifactId = yield* flag(flags, 'artifact')
      const file = yield* flag(flags, 'file')
      const side = yield* flag(flags, 'side')
      const body = yield* flag(flags, 'body')
      const line =
        'line' in flags && flags.line !== 'true'
          ? { line: Number(flags.line) }
          : {}
      const replyTo =
        'reply-to' in flags && flags['reply-to'] !== 'true'
          ? { in_reply_to: flags['reply-to'] }
          : {}
      return {
        method: 'POST',
        path: `/v1/reviews/${encodePathSegment(reviewId)}/comments`,
        body: {
          review_id: reviewId,
          work_id: workId,
          workspace_id: workspaceId,
          target: { artifact_id: artifactId, file, side, ...line },
          body,
          ...replyTo,
        },
        label: 'review comment',
      }
    }),

  'review comment resolve': commentIdCommand('resolve'),
  'review comment reopen': commentIdCommand('reopen'),

  'review comment list': ({ flags }) =>
    Either.gen(function* () {
      if ('review' in flags && flags.review !== 'true') {
        const reviewId = yield* flag(flags, 'review')
        return {
          method: 'GET',
          path: `/v1/reviews/${encodePathSegment(reviewId)}/comments`,
          label: 'review comment list',
        }
      }
      const workId = yield* flag(flags, 'work')
      return {
        method: 'GET',
        path: `/v1/work/${encodePathSegment(workId)}/review-comments`,
        label: 'review comment list',
      }
    }),
}
