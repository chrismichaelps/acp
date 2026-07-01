/** @Acp.App.Cli.Commands — pure argv to CliRequest parser */
import { Either } from 'effect'
import {
  CliError,
  csvFlag,
  encodePathSegment,
  flag,
  positional,
  scopedWorkListPath,
  type CliRequest,
  type CommandHandler,
  type Parsed,
} from './command-support.js'
import { artifactCommandHandlers } from './artifact-commands.js'
import { checkpointCommandHandlers } from './checkpoint-commands.js'
import { eventCommandHandlers } from './event-commands.js'
import { leaseCommandHandlers } from './lease-commands.js'
import { memoryCommandHandlers } from './memory-commands.js'
import { sessionCommandHandlers } from './session-commands.js'
import { workCommandHandlers } from './work-commands.js'
import { workerCommandHandlers } from './worker-commands.js'
import { workspaceCommandHandlers } from './workspace-commands.js'

export { CliError, type CliRequest } from './command-support.js'

interface ArgCursor {
  readonly flags: Record<string, string>
  readonly index: number
  readonly positionals: string[]
}

interface ArgTokenParser {
  readonly matches: (token: string) => boolean
  readonly read: (argv: readonly string[], cursor: ArgCursor) => ArgCursor
}

interface CommandResolver {
  readonly resolve: (argv: readonly string[]) => CommandHandler
}

const isFlagToken = (token: string): boolean => token.startsWith('--')

const argTokenParsers: readonly ArgTokenParser[] = [
  {
    matches: isFlagToken,
    read: (argv, cursor) => {
      const token = argv[cursor.index]
      const key = token.slice(2)
      const valueIndex = cursor.index + 1
      const value = argv[valueIndex]
      const hasValue = valueIndex < argv.length && !isFlagToken(value)
      return {
        ...cursor,
        flags: { ...cursor.flags, [key]: hasValue ? value : 'true' },
        index: cursor.index + (hasValue ? 2 : 1),
      }
    },
  },
  {
    matches: () => true,
    read: (argv, cursor) => ({
      ...cursor,
      index: cursor.index + 1,
      positionals: [...cursor.positionals, argv[cursor.index]],
    }),
  },
]

const splitArgs = (argv: readonly string[]): Parsed => {
  let cursor: ArgCursor = { flags: {}, index: 0, positionals: [] }
  while (cursor.index < argv.length) {
    const token = argv[cursor.index]
    const parser = argTokenParsers.find((candidate) => candidate.matches(token))
    cursor = parser?.read(argv, cursor) ?? cursor
  }
  return { flags: cursor.flags, positionals: cursor.positionals }
}

const reviewStateCommand =
  (action: 'reject' | 'request_changes' | 'cancel'): CommandHandler =>
  ({ positionals }) =>
    Either.map(positional(positionals, 0, 'review_id'), (reviewId) => ({
      method: 'POST' as const,
      path: `/v1/reviews/${encodePathSegment(reviewId)}/${action}`,
      label: `review ${action.replace('_', '-')}`,
    }))

const unknown = (argv: readonly string[]): Either.Either<never, CliError> =>
  Either.left(new CliError({ message: `unknown command: ${argv.join(' ')}` }))

const unknownCommandHandler =
  (argv: readonly string[]): CommandHandler =>
  () =>
    unknown(argv)

const commandKey = (group: string | undefined, action: string | undefined) =>
  `${group ?? ''} ${action ?? ''}`

const commandHandlers: Readonly<Record<string, CommandHandler | undefined>> = {
  ...sessionCommandHandlers,

  ...workerCommandHandlers,

  ...workspaceCommandHandlers,

  ...workCommandHandlers,

  ...leaseCommandHandlers,

  ...checkpointCommandHandlers,

  ...artifactCommandHandlers,

  ...memoryCommandHandlers,

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
      return {
        method: 'POST',
        path: `/v1/reviews/${encodePathSegment(reviewId)}/approve`,
        body: { met_requirements: metRequirements },
        label: 'review approve',
      }
    }),

  'review reject': reviewStateCommand('reject'),
  'review request-changes': reviewStateCommand('request_changes'),
  'review cancel': reviewStateCommand('cancel'),

  ...eventCommandHandlers,
}

const commandResolver: CommandResolver = {
  resolve: (argv) =>
    commandHandlers[commandKey(argv[0], argv[1])] ??
    unknownCommandHandler(argv),
}

export const parseArgs = (
  argv: readonly string[],
): Either.Either<CliRequest, CliError> => {
  const parsed = splitArgs(argv.slice(2))
  return commandResolver.resolve(argv)(parsed)
}
