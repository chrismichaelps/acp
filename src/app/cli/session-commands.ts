/** @Acp.App.Cli.SessionCommands — session bootstrap command map */
import { Either } from 'effect'
import {
  csvFlag,
  flag,
  optional,
  type CommandHandler,
} from './command-support.js'

const optionalCsv = (flags: Readonly<Record<string, string>>, key: string) =>
  key in flags ? csvFlag(flags, key) : Either.right<readonly string[]>([])

const optionalKind = (flags: Readonly<Record<string, string>>) =>
  'kind' in flags && flags.kind !== 'true' ? flags.kind : 'agent'

export const sessionCommandHandlers: Readonly<
  Record<string, CommandHandler | undefined>
> = {
  'session init': ({ flags }) =>
    Either.gen(function* () {
      const workerId = yield* flag(flags, 'worker')
      const name = yield* flag(flags, 'name')
      const capabilities = yield* optionalCsv(flags, 'capabilities')
      const permissions = yield* optionalCsv(flags, 'permissions')
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
        },
        label: 'session init',
      }
    }),
}
