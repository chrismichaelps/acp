/** @Acp.App.Cli.Commands — pure argv to CliRequest parser */
import { Either } from 'effect'
import {
  CliError,
  csvFlag,
  encodePathSegment,
  flag,
  optional,
  optionalAs,
  positional,
  type CliRequest,
  type CommandHandler,
  type Parsed,
} from './command-support.js'
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

const scopedWorkListPath = (
  flags: Readonly<Record<string, string>>,
  collection: string,
): Either.Either<string, CliError> =>
  Either.gen(function* () {
    if ('workspace' in flags) {
      const workspaceId = yield* flag(flags, 'workspace')
      return `/v1/workspaces/${encodePathSegment(workspaceId)}/${collection}`
    }
    const workId = yield* flag(flags, 'work')
    return `/v1/work/${encodePathSegment(workId)}/${collection}`
  })

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

  'checkpoint create': ({ flags }) =>
    Either.gen(function* () {
      const workspaceId = yield* flag(flags, 'workspace')
      const workId = yield* flag(flags, 'work')
      const summary = yield* flag(flags, 'summary')
      return {
        method: 'POST',
        path: '/v1/checkpoints',
        body: {
          workspace_id: workspaceId,
          work_id: workId,
          summary,
          completed_steps: [],
          remaining_steps: [],
          modified_resources: [],
        },
        label: 'checkpoint create',
      }
    }),

  'checkpoint list': ({ flags }) =>
    Either.gen(function* () {
      const path = yield* scopedWorkListPath(flags, 'checkpoints')
      return {
        method: 'GET',
        path,
        label: 'checkpoint list',
      }
    }),

  'checkpoint latest': ({ flags }) =>
    Either.gen(function* () {
      const workId = yield* flag(flags, 'work')
      return {
        method: 'GET',
        path: `/v1/work/${encodePathSegment(workId)}/checkpoints/latest`,
        label: 'checkpoint latest',
      }
    }),

  'artifact create': ({ flags }) =>
    Either.gen(function* () {
      const workspaceId = yield* flag(flags, 'workspace')
      const workId = yield* flag(flags, 'work')
      const kind = yield* flag(flags, 'kind')
      return {
        method: 'POST',
        path: '/v1/artifacts',
        body: {
          workspace_id: workspaceId,
          work_id: workId,
          kind,
          ...optional(flags, 'uri'),
          ...optional(flags, 'summary'),
          ...optional(flags, 'content'),
        },
        label: 'artifact create',
      }
    }),

  'artifact pr': ({ flags }) =>
    Either.gen(function* () {
      const workspaceId = yield* flag(flags, 'workspace')
      const workId = yield* flag(flags, 'work')
      const uri = yield* flag(flags, 'url')
      return {
        method: 'POST',
        path: '/v1/artifacts',
        body: {
          workspace_id: workspaceId,
          work_id: workId,
          kind: 'pull_request',
          uri,
          ...optional(flags, 'summary'),
        },
        label: 'artifact pr',
      }
    }),

  'artifact update': ({ positionals, flags }) =>
    Either.gen(function* () {
      const artifactId = yield* positional(positionals, 0, 'artifact_id')
      const kind = yield* flag(flags, 'kind')
      return {
        method: 'PATCH',
        path: `/v1/artifacts/${encodePathSegment(artifactId)}`,
        body: {
          kind,
          ...optional(flags, 'uri'),
          ...optionalAs(flags, 'media-type', 'media_type'),
          ...optional(flags, 'summary'),
          ...optional(flags, 'content'),
        },
        label: 'artifact update',
      }
    }),

  'artifact list': ({ flags }) =>
    Either.gen(function* () {
      const path = yield* scopedWorkListPath(flags, 'artifacts')
      return {
        method: 'GET',
        path,
        label: 'artifact list',
      }
    }),

  'artifact content': ({ positionals }) =>
    Either.gen(function* () {
      const artifactId = yield* positional(positionals, 0, 'artifact_id')
      return {
        method: 'GET',
        path: `/v1/artifacts/${encodePathSegment(artifactId)}/content`,
        label: 'artifact content',
      }
    }),

  'artifact delete': ({ positionals }) =>
    Either.gen(function* () {
      const artifactId = yield* positional(positionals, 0, 'artifact_id')
      return {
        method: 'DELETE',
        path: `/v1/artifacts/${encodePathSegment(artifactId)}`,
        label: 'artifact delete',
      }
    }),

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
