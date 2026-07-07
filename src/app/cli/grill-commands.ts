/** @Acp.App.Cli.GrillCommands — grill gate argv parser entries */
import { Either } from 'effect'
import {
  encodePathSegment,
  flag,
  positional,
  CliError,
  type CommandHandler,
} from './command-support.js'

const grillVerdict = (
  flags: Readonly<Record<string, string>>,
): Either.Either<'accepted' | 'rejected', CliError> => {
  const accept = 'accept' in flags
  const reject = 'reject' in flags
  if (accept === reject) {
    return Either.left(
      new CliError({
        message: 'grill verdict requires exactly one of --accept or --reject',
      }),
    )
  }
  return Either.right(accept ? 'accepted' : 'rejected')
}

export const grillCommandHandlers: Readonly<Record<string, CommandHandler>> = {
  'grill open': ({ flags }) =>
    Either.gen(function* () {
      const reviewId = yield* flag(flags, 'review')
      const workId = yield* flag(flags, 'work')
      const workspaceId = yield* flag(flags, 'workspace')
      return {
        method: 'POST',
        path: `/v1/reviews/${encodePathSegment(reviewId)}/grill`,
        body: {
          review_id: reviewId,
          work_id: workId,
          workspace_id: workspaceId,
        },
        label: 'grill open',
      }
    }),

  'grill ask': ({ positionals, flags }) =>
    Either.gen(function* () {
      const grillId = yield* positional(positionals, 0, 'grill_id')
      const severity = yield* flag(flags, 'severity')
      const prompt = yield* flag(flags, 'prompt')
      return {
        method: 'POST',
        path: `/v1/grills/${encodePathSegment(grillId)}/questions`,
        body: { prompt, severity },
        label: 'grill ask',
      }
    }),

  'grill answer': ({ positionals, flags }) =>
    Either.gen(function* () {
      const questionId = yield* positional(positionals, 0, 'question_id')
      const answer = yield* flag(flags, 'answer')
      return {
        method: 'POST',
        path: `/v1/grill-questions/${encodePathSegment(questionId)}/answer`,
        body: { answer },
        label: 'grill answer',
      }
    }),

  'grill verdict': ({ positionals, flags }) =>
    Either.gen(function* () {
      const questionId = yield* positional(positionals, 0, 'question_id')
      const verdict = yield* grillVerdict(flags)
      return {
        method: 'POST',
        path: `/v1/grill-questions/${encodePathSegment(questionId)}/verdict`,
        body: { verdict },
        label: 'grill verdict',
      }
    }),

  'grill evaluate': ({ positionals }) =>
    Either.map(positional(positionals, 0, 'grill_id'), (grillId) => ({
      method: 'POST' as const,
      path: `/v1/grills/${encodePathSegment(grillId)}/evaluate`,
      label: 'grill evaluate',
    })),

  'grill get': ({ positionals }) =>
    Either.map(positional(positionals, 0, 'grill_id'), (grillId) => ({
      method: 'GET' as const,
      path: `/v1/grills/${encodePathSegment(grillId)}`,
      label: 'grill get',
    })),

  'grill list': ({ flags }) =>
    Either.gen(function* () {
      const reviewId = yield* flag(flags, 'review')
      return {
        method: 'GET',
        path: `/v1/reviews/${encodePathSegment(reviewId)}/grills`,
        label: 'grill list',
      }
    }),
}
