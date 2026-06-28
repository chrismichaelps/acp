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

const positiveIntegerFlag = (
  flags: Readonly<Record<string, string>>,
  key: string,
): Either.Either<number, CliError> => {
  const raw = flags[key]
  const parsed = Number(raw)
  return Number.isSafeInteger(parsed) && parsed > 0
    ? Either.right(parsed)
    : Either.left(new CliError({ message: `invalid --${key}: ${raw}` }))
}

const unknown = (argv: readonly string[]): Either.Either<never, CliError> =>
  Either.left(new CliError({ message: `unknown command: ${argv.join(' ')}` }))

const commandKey = (group: string | undefined, action: string | undefined) =>
  `${group ?? ''} ${action ?? ''}`

const commandHandlers: Readonly<Record<string, CommandHandler | undefined>> = {
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

  'lease release': ({ positionals }) =>
    Either.gen(function* () {
      const leaseId = yield* positional(positionals, 0, 'lease_id')
      return {
        method: 'POST',
        path: `/v1/leases/${encodePathSegment(leaseId)}/release`,
        label: 'lease release',
      }
    }),

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
          ...optionalAs(flags, 'media-type', 'media_type'),
          ...optional(flags, 'summary'),
          ...optional(flags, 'content'),
        },
        label: 'artifact update',
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

  'review reject': ({ positionals }) =>
    Either.gen(function* () {
      const reviewId = yield* positional(positionals, 0, 'review_id')
      return {
        method: 'POST',
        path: `/v1/reviews/${encodePathSegment(reviewId)}/reject`,
        label: 'review reject',
      }
    }),

  'review request-changes': ({ positionals }) =>
    Either.gen(function* () {
      const reviewId = yield* positional(positionals, 0, 'review_id')
      return {
        method: 'POST',
        path: `/v1/reviews/${encodePathSegment(reviewId)}/request_changes`,
        label: 'review request-changes',
      }
    }),

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
}

export const parseArgs = (
  argv: readonly string[],
): Either.Either<CliRequest, CliError> => {
  const parsed = splitArgs(argv.slice(2))
  const handler = commandHandlers[commandKey(argv[0], argv[1])]

  return handler === undefined ? unknown(argv) : handler(parsed)
}

export const usage = `acp — Agent Coordination Protocol CLI

  acp workspace list
  acp workspace create --name <n> --kind <k> --uri <u> [--default-branch <b>]
  acp workspace update <workspace_id> --name <n> --kind <k> --uri <u> [--default-branch <b>]
  acp workspace archive <workspace_id>
  acp work create <title> --workspace <id> [--priority <p>] [--description <d>]
  acp work claim <work_id> --worker <id>
  acp work update <work_id> --state <state>
  acp lease request --workspace <id> --holder <id> --kind <k> --uri <u> [--ttl <n>]
  acp lease release <lease_id>
  acp checkpoint create --workspace <id> --work <id> --summary <s>
  acp artifact create --workspace <id> --work <id> --kind <k> [--summary <s>] [--content <c>]
  acp artifact update <artifact_id> --kind <k> [--media-type <m>] [--summary <s>] [--content <c>]
  acp artifact delete <artifact_id>
  acp review request --work <id> --by <id> [--reviewer <id>]
  acp review approve <review_id> --met <requirement,csv>
  acp review reject <review_id>
  acp review request-changes <review_id>
  acp events stream --workspace <id>

Targets ACP_BASE_URL (default http://localhost:$ACP_PORT).`
