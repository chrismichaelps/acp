/** @Acp.App.Cli.ReviewCommands — review argv parser entries */
import { Either } from 'effect'
import {
  csvFlag,
  encodePathSegment,
  flag,
  positional,
  scopedWorkListPath,
  type CliError,
  type CommandHandler,
} from './command-support.js'

const approvalSignature = (
  flags: Record<string, string>,
): Either.Either<Record<string, unknown>, CliError> =>
  Either.gen(function* () {
    if (!('signature' in flags) || flags.signature === 'true') return {}
    const algorithm = yield* flag(flags, 'signature-algorithm')
    const keyId = yield* flag(flags, 'signature-key')
    return {
      approval_signature: {
        algorithm,
        key_id: keyId,
        value: flags.signature,
        ...('signed-at' in flags && flags['signed-at'] !== 'true'
          ? { signed_at: flags['signed-at'] }
          : {}),
      },
    }
  })

const reviewStateCommand =
  (action: 'reject' | 'request_changes' | 'cancel'): CommandHandler =>
  ({ positionals }) =>
    Either.map(positional(positionals, 0, 'review_id'), (reviewId) => ({
      method: 'POST' as const,
      path: `/v1/reviews/${encodePathSegment(reviewId)}/${action}`,
      label: `review ${action.replace('_', '-')}`,
    }))

export const reviewCommandHandlers: Readonly<Record<string, CommandHandler>> = {
  'review request': ({ flags }) =>
    Either.gen(function* () {
      const workId = yield* flag(flags, 'work')
      const requestedBy = yield* flag(flags, 'by')
      const reviewer =
        'reviewer' in flags && flags.reviewer !== 'true'
          ? { reviewer: flags.reviewer }
          : {}
      return {
        method: 'POST',
        path: '/v1/reviews',
        body: {
          work_id: workId,
          requested_by: requestedBy,
          requirements: [],
          ...reviewer,
        },
        label: 'review request',
      }
    }),

  'review list': ({ flags }) =>
    Either.gen(function* () {
      const path = yield* scopedWorkListPath(flags, 'reviews')
      return {
        method: 'GET',
        path,
        label: 'review list',
      }
    }),

  'review approve': ({ positionals, flags }) =>
    Either.gen(function* () {
      const reviewId = yield* positional(positionals, 0, 'review_id')
      const metRequirements = yield* csvFlag(flags, 'met')
      const signature = yield* approvalSignature(flags)
      return {
        method: 'POST',
        path: `/v1/reviews/${encodePathSegment(reviewId)}/approve`,
        body: Object.assign({ met_requirements: metRequirements }, signature),
        label: 'review approve',
      }
    }),

  'review reject': reviewStateCommand('reject'),
  'review request-changes': reviewStateCommand('request_changes'),
  'review cancel': reviewStateCommand('cancel'),
}
