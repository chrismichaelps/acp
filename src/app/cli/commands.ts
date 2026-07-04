/** @Acp.App.Cli.Commands — pure argv to CliRequest parser */
import { Either } from 'effect'
import {
  CliError,
  type CliRequest,
  type CommandHandler,
  type Parsed,
} from './command-support.js'
import { artifactCommandHandlers } from './artifact-commands.js'
import { checkpointCommandHandlers } from './checkpoint-commands.js'
import { eventCommandHandlers } from './event-commands.js'
import { leaseCommandHandlers } from './lease-commands.js'
import { memoryCommandHandlers } from './memory-commands.js'
import { reviewCommandHandlers } from './review-commands.js'
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

type CommandHandlerTable = Readonly<Record<string, CommandHandler | undefined>>

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

const unknown = (argv: readonly string[]): Either.Either<never, CliError> =>
  Either.left(new CliError({ message: `unknown command: ${argv.join(' ')}` }))

const unknownCommandHandler =
  (argv: readonly string[]): CommandHandler =>
  () =>
    unknown(argv)

const commandKey = (group: string | undefined, action: string | undefined) =>
  `${group ?? ''} ${action ?? ''}`

export const buildCommandRegistry = (
  tables: readonly CommandHandlerTable[],
): ReadonlyMap<string, CommandHandler> => {
  const registry = new Map<string, CommandHandler>()
  for (const table of tables) {
    for (const [key, handler] of Object.entries(table)) {
      if (handler === undefined) continue
      if (registry.has(key)) {
        throw new Error(`duplicate CLI command handler: ${key}`)
      }
      registry.set(key, handler)
    }
  }
  return registry
}

const commandRegistry = buildCommandRegistry([
  sessionCommandHandlers,
  workerCommandHandlers,
  workspaceCommandHandlers,
  workCommandHandlers,
  leaseCommandHandlers,
  checkpointCommandHandlers,
  artifactCommandHandlers,
  memoryCommandHandlers,
  reviewCommandHandlers,
  eventCommandHandlers,
])

const commandResolver: CommandResolver = {
  resolve: (argv) =>
    commandRegistry.get(commandKey(argv[0], argv[1])) ??
    unknownCommandHandler(argv),
}

export const parseArgs = (
  argv: readonly string[],
): Either.Either<CliRequest, CliError> => {
  const parsed = splitArgs(argv.slice(2))
  return commandResolver.resolve(argv)(parsed)
}
