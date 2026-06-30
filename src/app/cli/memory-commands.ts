/** @Acp.App.Cli.MemoryCommands — memory argv parser entries */
import { Either } from 'effect'
import {
  flag,
  integerFlag,
  optionalAs,
  optionalQuery,
  csvFlag,
  type CommandHandler,
} from './command-support.js'

export const memoryCommandHandlers: Readonly<Record<string, CommandHandler>> = {
  'memory create': ({ flags }) =>
    Either.gen(function* () {
      const workspaceId = yield* flag(flags, 'workspace')
      const kind = yield* flag(flags, 'kind')
      const key = yield* flag(flags, 'key')
      const summary = yield* flag(flags, 'summary')
      const content = yield* flag(flags, 'content')
      const labels = 'labels' in flags ? yield* csvFlag(flags, 'labels') : []
      return {
        method: 'POST',
        path: '/v1/memory',
        body: {
          workspace_id: workspaceId,
          kind,
          key,
          summary,
          content,
          labels,
          ...optionalAs(flags, 'work', 'work_id'),
        },
        label: 'memory create',
      }
    }),

  'memory list': ({ flags }) =>
    Either.gen(function* () {
      const workspaceId = yield* flag(flags, 'workspace')
      const afterSeq =
        'after' in flags ? yield* integerFlag(flags, 'after', 0) : 0
      const query = [
        `workspace_id=${encodeURIComponent(workspaceId)}`,
        `after_seq=${afterSeq.toString()}`,
        ...optionalQuery(flags, 'limit'),
        ...optionalQuery(flags, 'work', 'work_id'),
        ...optionalQuery(flags, 'kind'),
        ...optionalQuery(flags, 'key'),
        ...optionalQuery(flags, 'label'),
      ].join('&')
      return {
        method: 'GET',
        path: `/v1/memory?${query}`,
        label: 'memory list',
      }
    }),
}
