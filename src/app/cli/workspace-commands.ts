/** @Acp.App.Cli.WorkspaceCommands — workspace argv parser entries */
import { Either } from 'effect'
import {
  encodePathSegment,
  flag,
  optionalAs,
  positional,
  type CommandHandler,
} from './command-support.js'

export const workspaceCommandHandlers: Readonly<
  Record<string, CommandHandler>
> = {
  'workspace list': () =>
    Either.right({
      method: 'GET',
      path: '/v1/workspaces',
      label: 'workspace list',
    }),

  'workspace create': ({ flags }) =>
    Either.gen(function* () {
      const name = yield* flag(flags, 'name')
      const kind = yield* flag(flags, 'kind')
      const uri = yield* flag(flags, 'uri')
      return {
        method: 'POST',
        path: '/v1/workspaces',
        body: {
          name,
          kind,
          uri,
          ...optionalAs(flags, 'default-branch', 'default_branch'),
        },
        label: 'workspace create',
      }
    }),

  'workspace update': ({ positionals, flags }) =>
    Either.gen(function* () {
      const workspaceId = yield* positional(positionals, 0, 'workspace_id')
      const name = yield* flag(flags, 'name')
      const kind = yield* flag(flags, 'kind')
      const uri = yield* flag(flags, 'uri')
      return {
        method: 'PATCH',
        path: `/v1/workspaces/${encodePathSegment(workspaceId)}`,
        body: {
          name,
          kind,
          uri,
          ...optionalAs(flags, 'default-branch', 'default_branch'),
        },
        label: 'workspace update',
      }
    }),

  'workspace archive': ({ positionals }) =>
    Either.gen(function* () {
      const workspaceId = yield* positional(positionals, 0, 'workspace_id')
      return {
        method: 'POST',
        path: `/v1/workspaces/${encodePathSegment(workspaceId)}/archive`,
        label: 'workspace archive',
      }
    }),
}
