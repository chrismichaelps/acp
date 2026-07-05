/** @Acp.App.Cli.LeaseCommands — lease argv parser entries */
import { Either } from 'effect'
import {
  encodePathSegment,
  flag,
  optionalClientFilter,
  positional,
  positiveIntegerFlag,
  type CommandHandler,
} from './command-support.js'

const leaseStateCommand =
  (action: 'release' | 'revoke'): CommandHandler =>
  ({ positionals }) =>
    Either.map(positional(positionals, 0, 'lease_id'), (leaseId) => ({
      method: 'POST' as const,
      path: `/v1/leases/${encodePathSegment(leaseId)}/${action}`,
      label: `lease ${action}`,
    }))

export const leaseCommandHandlers: Readonly<Record<string, CommandHandler>> = {
  'lease request': ({ flags }) =>
    Either.gen(function* () {
      const workspaceId = yield* flag(flags, 'workspace')
      const holder = yield* flag(flags, 'holder')
      const kind = yield* flag(flags, 'kind')
      const uri = yield* flag(flags, 'uri')
      const ttlSeconds =
        'ttl' in flags ? yield* positiveIntegerFlag(flags, 'ttl') : undefined
      const ttl = ttlSeconds === undefined ? {} : { ttl_seconds: ttlSeconds }
      return {
        method: 'POST',
        path: '/v1/leases',
        body: {
          workspace_id: workspaceId,
          holder,
          resource: { kind, uri },
          ...ttl,
        },
        label: 'lease request',
      }
    }),

  'lease list': ({ flags }) =>
    Either.gen(function* () {
      const workspaceId = yield* flag(flags, 'workspace')
      const clientFilters = optionalClientFilter(flags, 'holder')
      return {
        method: 'GET',
        path: `/v1/leases?workspace_id=${encodeURIComponent(workspaceId)}`,
        ...(clientFilters.length > 0 ? { clientFilters } : {}),
        label: 'lease list',
      }
    }),

  'lease release': leaseStateCommand('release'),

  'lease renew': ({ positionals, flags }) =>
    Either.gen(function* () {
      const leaseId = yield* positional(positionals, 0, 'lease_id')
      const body =
        'ttl' in flags
          ? { ttl_seconds: yield* positiveIntegerFlag(flags, 'ttl') }
          : {}
      return {
        method: 'POST',
        path: `/v1/leases/${encodePathSegment(leaseId)}/renew`,
        body,
        label: 'lease renew',
      }
    }),

  'lease revoke': leaseStateCommand('revoke'),
}
