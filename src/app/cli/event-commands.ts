/** @Acp.App.Cli.EventCommands — event argv parser entries */
import { Either } from 'effect'
import {
  flag,
  integerFlag,
  optionalClientFilter,
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
      const afterSeq =
        'after' in flags ? yield* integerFlag(flags, 'after', 0) : 0
      const clientFilters = optionalClientFilter(flags, 'type')
      return {
        method: 'GET',
        path: `/v1/events?workspace_id=${encodeURIComponent(workspaceId)}&after_seq=${afterSeq.toString()}`,
        ...(clientFilters.length > 0 ? { clientFilters } : {}),
        label: 'events list',
      }
    }),
}
