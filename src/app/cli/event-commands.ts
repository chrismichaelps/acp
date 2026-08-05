/** @Acp.App.Cli.EventCommands — event argv parser entries */
import { Either } from 'effect'
import {
  CliError,
  flag,
  integerFlag,
  optionalQuery,
  positiveIntegerFlag,
  type CommandHandler,
} from './command-support.js'

export const eventCommandHandlers: Readonly<Record<string, CommandHandler>> = {
  'events stream': ({ flags }) =>
    Either.gen(function* () {
      const workspaceId = yield* flag(flags, 'workspace')
      return {
        method: 'GET',
        path: `/v1/events/stream?workspace_id=${encodeURIComponent(workspaceId)}`,
        stream: true,
        label: 'events stream',
      }
    }),

  'events list': ({ flags }) =>
    Either.gen(function* () {
      const workspaceId = yield* flag(flags, 'workspace')
      // `--tail` reads newest-first and `--after` reads forward from a cursor;
      // a request carrying both has no single meaning, so refuse it here rather
      // than let the host reject it after a round trip.
      if ('tail' in flags && 'after' in flags) {
        yield* Either.left(
          new CliError({
            message: 'events list: --tail and --after are mutually exclusive',
          }),
        )
      }
      const tail =
        'tail' in flags ? yield* positiveIntegerFlag(flags, 'tail') : undefined
      const afterSeq =
        'after' in flags ? yield* integerFlag(flags, 'after', 0) : 0
      if ('limit' in flags) {
        yield* positiveIntegerFlag(flags, 'limit')
      }
      const query = [
        `workspace_id=${encodeURIComponent(workspaceId)}`,
        ...(tail === undefined
          ? [
              `after_seq=${afterSeq.toString()}`,
              ...optionalQuery(flags, 'limit'),
            ]
          : [`tail=${tail.toString()}`]),
        ...optionalQuery(flags, 'type'),
      ].join('&')
      return {
        method: 'GET',
        path: `/v1/events?${query}`,
        label: 'events list',
      }
    }),
}
