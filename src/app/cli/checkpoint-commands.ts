/** @Acp.App.Cli.CheckpointCommands — checkpoint argv parser entries */
import { Either } from 'effect'
import {
  encodePathSegment,
  flag,
  scopedWorkListPath,
  type CommandHandler,
} from './command-support.js'

export const checkpointCommandHandlers: Readonly<
  Record<string, CommandHandler>
> = {
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
}
