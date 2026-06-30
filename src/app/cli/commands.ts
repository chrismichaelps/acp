/** @Acp.App.Cli.Commands — pure argv to CliRequest parser */
import { Data, Either } from 'effect'

export interface CliRequest {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  readonly path: string
  readonly body?: Record<string, unknown>
  readonly stream?: boolean
  readonly label: string
}

export class CliError extends Data.TaggedError('CliError')<{
  readonly message: string
}> {}

interface Parsed {
  readonly positionals: readonly string[]
  readonly flags: Readonly<Record<string, string>>
}

type CommandHandler = (parsed: Parsed) => Either.Either<CliRequest, CliError>

const splitArgs = (argv: readonly string[]): Parsed => {
  const positionals: string[] = []
  const flags: Record<string, string> = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token.startsWith('--')) {
      const key = token.slice(2)
      const hasValue = i + 1 < argv.length && !argv[i + 1].startsWith('--')
      if (hasValue) {
        const next = argv[i + 1]
        flags[key] = next
        i += 1
      } else {
        flags[key] = 'true'
      }
    } else {
      positionals.push(token)
    }
  }
  return { positionals, flags }
}

const flag = (
  flags: Readonly<Record<string, string>>,
  key: string,
): Either.Either<string, CliError> =>
  key in flags && flags[key] !== 'true'
    ? Either.right(flags[key])
    : Either.left(new CliError({ message: `missing required --${key}` }))

const positional = (
  positionals: readonly string[],
  index: number,
  name: string,
): Either.Either<string, CliError> =>
  index < positionals.length
    ? Either.right(positionals[index])
    : Either.left(new CliError({ message: `missing <${name}>` }))

const optional = (
  flags: Readonly<Record<string, string>>,
  key: string,
): Record<string, string> =>
  key in flags && flags[key] !== 'true' ? { [key]: flags[key] } : {}

const optionalAs = (
  flags: Readonly<Record<string, string>>,
  key: string,
  field: string,
): Record<string, string> =>
  key in flags && flags[key] !== 'true' ? { [field]: flags[key] } : {}

const optionalQuery = (
  flags: Readonly<Record<string, string>>,
  key: string,
  field: string = key,
): readonly string[] =>
  key in flags && flags[key] !== 'true'
    ? [`${field}=${encodeURIComponent(flags[key])}`]
    : []

const csvFlag = (
  flags: Readonly<Record<string, string>>,
  key: string,
): Either.Either<readonly string[], CliError> =>
  Either.map(flag(flags, key), (value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== ''),
  )

const encodePathSegment = (value: string): string => encodeURIComponent(value)

const scopedWorkListPath = (
  flags: Readonly<Record<string, string>>,
  collection: string,
): Either.Either<string, CliError> =>
  Either.gen(function* () {
    if ('workspace' in flags) {
      const workspaceId = yield* flag(flags, 'workspace')
      return `/v1/workspaces/${encodePathSegment(workspaceId)}/${collection}`
    }
    const workId = yield* flag(flags, 'work')
    return `/v1/work/${encodePathSegment(workId)}/${collection}`
  })

const integerFlag = (
  flags: Readonly<Record<string, string>>,
  key: string,
  min: number,
): Either.Either<number, CliError> => {
  const raw = flags[key]
  const parsed = Number(raw)
  return Number.isSafeInteger(parsed) && parsed >= min
    ? Either.right(parsed)
    : Either.left(new CliError({ message: `invalid --${key}: ${raw}` }))
}

const positiveIntegerFlag = (
  flags: Readonly<Record<string, string>>,
  key: string,
) => integerFlag(flags, key, 1)

const leaseStateCommand =
  (action: 'release' | 'revoke'): CommandHandler =>
  ({ positionals }) =>
    Either.map(positional(positionals, 0, 'lease_id'), (leaseId) => ({
      method: 'POST' as const,
      path: `/v1/leases/${encodePathSegment(leaseId)}/${action}`,
      label: `lease ${action}`,
    }))

const reviewStateCommand =
  (action: 'reject' | 'request_changes' | 'cancel'): CommandHandler =>
  ({ positionals }) =>
    Either.map(positional(positionals, 0, 'review_id'), (reviewId) => ({
      method: 'POST' as const,
      path: `/v1/reviews/${encodePathSegment(reviewId)}/${action}`,
      label: `review ${action.replace('_', '-')}`,
    }))

const unknown = (argv: readonly string[]): Either.Either<never, CliError> =>
  Either.left(new CliError({ message: `unknown command: ${argv.join(' ')}` }))

const commandKey = (group: string | undefined, action: string | undefined) =>
  `${group ?? ''} ${action ?? ''}`

const commandHandlers: Readonly<Record<string, CommandHandler | undefined>> = {
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
      return {
        method: 'GET',
        path: `/v1/workspaces/${encodePathSegment(workspaceId)}/work`,
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
      return {
        method: 'GET',
        path,
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

  'review request': ({ flags }) =>
    Either.gen(function* () {
      const workId = yield* flag(flags, 'work')
      const requestedBy = yield* flag(flags, 'by')
      const reviewer =
        'reviewer' in flags && flags.reviewer !== 'true'
          ? { reviewer: flags.reviewer }
          : {}
      return {
        method: 'POST',
        path: '/v1/reviews',
        body: {
          work_id: workId,
          requested_by: requestedBy,
          requirements: [],
          ...reviewer,
        },
        label: 'review request',
      }
    }),

  'review list': ({ flags }) =>
    Either.gen(function* () {
      const path = yield* scopedWorkListPath(flags, 'reviews')
      return {
        method: 'GET',
        path,
        label: 'review list',
      }
    }),

  'review approve': ({ positionals, flags }) =>
    Either.gen(function* () {
      const reviewId = yield* positional(positionals, 0, 'review_id')
      const metRequirements = yield* csvFlag(flags, 'met')
      return {
        method: 'POST',
        path: `/v1/reviews/${encodePathSegment(reviewId)}/approve`,
        body: { met_requirements: metRequirements },
        label: 'review approve',
      }
    }),

  'review reject': reviewStateCommand('reject'),
  'review request-changes': reviewStateCommand('request_changes'),
  'review cancel': reviewStateCommand('cancel'),

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
      return {
        method: 'GET',
        path: `/v1/events?workspace_id=${encodeURIComponent(workspaceId)}&after_seq=${afterSeq.toString()}`,
        label: 'events list',
      }
    }),
}

export const parseArgs = (
  argv: readonly string[],
): Either.Either<CliRequest, CliError> => {
  const parsed = splitArgs(argv.slice(2))
  const handler = commandHandlers[commandKey(argv[0], argv[1])]

  return handler === undefined ? unknown(argv) : handler(parsed)
}
