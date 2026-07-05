/** @Acp.App.Cli.WorkCommands — work argv parser entries */
import { Either } from 'effect'
import {
  encodePathSegment,
  flag,
  optional,
  positional,
  type CommandHandler,
} from './command-support.js'

export const workCommandHandlers: Readonly<Record<string, CommandHandler>> = {
  'work create': ({ positionals, flags }) =>
    Either.gen(function* () {
      const title = yield* positional(positionals, 0, 'title')
      const workspaceId = yield* flag(flags, 'workspace')
      return {
        method: 'POST',
        path: '/v1/work',
        body: {
          workspace_id: workspaceId,
          title,
          ...optional(flags, 'description'),
          ...optional(flags, 'priority'),
        },
        label: 'work create',
      }
    }),

  'work list': ({ flags }) =>
    Either.gen(function* () {
      const workspaceId = yield* flag(flags, 'workspace')
      const filter =
        'state' in flags && flags.state !== 'true'
          ? { filterState: flags.state }
          : {}
      return {
        method: 'GET',
        path: `/v1/workspaces/${encodePathSegment(workspaceId)}/work`,
        ...filter,
        label: 'work list',
      }
    }),

  'work get': ({ positionals }) =>
    Either.gen(function* () {
      const workId = yield* positional(positionals, 0, 'work_id')
      return {
        method: 'GET',
        path: `/v1/work/${encodePathSegment(workId)}`,
        label: 'work get',
      }
    }),

  'work claim': ({ positionals, flags }) =>
    Either.gen(function* () {
      const workId = yield* positional(positionals, 0, 'work_id')
      const worker = yield* flag(flags, 'worker')
      return {
        method: 'POST',
        path: `/v1/work/${encodePathSegment(workId)}/claim`,
        body: { worker_id: worker },
        label: 'work claim',
      }
    }),

  'work update': ({ positionals, flags }) =>
    Either.gen(function* () {
      const workId = yield* positional(positionals, 0, 'work_id')
      const state = yield* flag(flags, 'state')
      return {
        method: 'PATCH',
        path: `/v1/work/${encodePathSegment(workId)}`,
        body: { state },
        label: 'work update',
      }
    }),
}
