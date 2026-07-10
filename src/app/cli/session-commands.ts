/** @Acp.App.Cli.SessionCommands — session bootstrap command map */
import { Either } from 'effect'
import {
  CliError,
  csvFlag,
  flag,
  optional,
  type CommandHandler,
  type Parsed,
} from './command-support.js'

const optionalCsv = (flags: Readonly<Record<string, string>>, key: string) =>
  key in flags ? csvFlag(flags, key) : Either.right<readonly string[]>([])

const optionalKind = (flags: Readonly<Record<string, string>>) =>
  'kind' in flags && flags.kind !== 'true' ? flags.kind : 'agent'

const workspaceIdPattern = /^workspace_[A-Za-z0-9][A-Za-z0-9_-]*$/

const optionalWorkspaceIds = (
  parsed: Parsed,
): Either.Either<readonly string[] | undefined, CliError> => {
  const rawValues = parsed.flagValues.workspace ?? []
  if (rawValues.length === 0) return Either.right(undefined)

  const workspaceIds = rawValues.flatMap((raw) =>
    raw.split(',').map((item) => item.trim()),
  )
  const invalid = workspaceIds.find(
    (workspaceId) => !workspaceIdPattern.test(workspaceId),
  )
  return invalid === undefined
    ? Either.right([...new Set(workspaceIds)])
    : Either.left(
        new CliError({
          message: `invalid --workspace: ${invalid === '' ? 'empty identifier' : invalid}`,
        }),
      )
}

export const sessionCommandHandlers: Readonly<
  Record<string, CommandHandler | undefined>
> = {
  'session init': (parsed) =>
    Either.gen(function* () {
      const { flags } = parsed
      const workerId = yield* flag(flags, 'worker')
      const name = yield* flag(flags, 'name')
      const capabilities = yield* optionalCsv(flags, 'capabilities')
      const permissions = yield* optionalCsv(flags, 'permissions')
      const workspaceIds = yield* optionalWorkspaceIds(parsed)
      return {
        method: 'POST',
        path: '/v1/session/initialize',
        body: {
          worker: {
            id: workerId,
            name,
            kind: optionalKind(flags),
            ...optional(flags, 'vendor'),
            capabilities,
          },
          permissions,
          ...(workspaceIds === undefined
            ? {}
            : { workspace_ids: workspaceIds }),
        },
        label: 'session init',
      }
    }),
}
