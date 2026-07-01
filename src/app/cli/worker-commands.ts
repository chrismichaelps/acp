/** @Acp.App.Cli.WorkerCommands — worker argv parser entries */
import { Either } from 'effect'
import {
  encodePathSegment,
  positional,
  type CommandHandler,
} from './command-support.js'

export const workerCommandHandlers: Readonly<Record<string, CommandHandler>> = {
  'worker list': () =>
    Either.right({
      method: 'GET',
      path: '/v1/workers',
      label: 'worker list',
    }),

  'worker get': ({ positionals }) =>
    Either.map(positional(positionals, 0, 'worker_id'), (workerId) => ({
      method: 'GET' as const,
      path: `/v1/workers/${encodePathSegment(workerId)}`,
      label: 'worker get',
    })),
}
