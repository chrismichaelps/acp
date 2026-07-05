/** @Acp.App.Cli.ArtifactCommands — artifact argv parser entries */
import { Either } from 'effect'
import {
  encodePathSegment,
  flag,
  optional,
  optionalAs,
  optionalClientFilter,
  positional,
  scopedWorkListPath,
  type CommandHandler,
} from './command-support.js'

export const artifactCommandHandlers: Readonly<Record<string, CommandHandler>> =
  {
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
        const clientFilters = optionalClientFilter(flags, 'kind')
        return {
          method: 'GET',
          path,
          ...(clientFilters.length > 0 ? { clientFilters } : {}),
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
  }
