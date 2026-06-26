/** @Acp.App.Cli.Commands — pure argv to CliRequest parser */
import { Data, Either } from 'effect'

export interface CliRequest {
  readonly method: 'GET' | 'POST' | 'PATCH'
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

export const parseArgs = (
  argv: readonly string[],
): Either.Either<CliRequest, CliError> => {
  const group = argv[0]
  const action = argv[1]
  const { positionals, flags } = splitArgs(argv.slice(2))

  if (group === 'workspace' && action === 'list') {
    return Either.right({
      method: 'GET',
      path: '/v1/workspaces',
      label: 'workspace list',
    })
  }

  if (group === 'work' && action === 'create') {
    return Either.gen(function* () {
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
    })
  }

  if (group === 'work' && action === 'claim') {
    return Either.gen(function* () {
      const workId = yield* positional(positionals, 0, 'work_id')
      const worker = yield* flag(flags, 'worker')
      return {
        method: 'POST',
        path: `/v1/work/${encodePathSegment(workId)}/claim`,
        body: { worker_id: worker },
        label: 'work claim',
      }
    })
  }

  if (group === 'work' && action === 'update') {
    return Either.gen(function* () {
      const workId = yield* positional(positionals, 0, 'work_id')
      const state = yield* flag(flags, 'state')
      return {
        method: 'PATCH',
        path: `/v1/work/${encodePathSegment(workId)}`,
        body: { state },
        label: 'work update',
      }
    })
  }

  if (group === 'lease' && action === 'request') {
    return Either.gen(function* () {
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
    })
  }

  if (group === 'lease' && action === 'release') {
    return Either.gen(function* () {
      const leaseId = yield* positional(positionals, 0, 'lease_id')
      return {
        method: 'POST',
        path: `/v1/leases/${encodePathSegment(leaseId)}/release`,
        label: 'lease release',
      }
    })
  }

  if (group === 'checkpoint' && action === 'create') {
    return Either.gen(function* () {
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
    })
  }

  if (group === 'artifact' && action === 'create') {
    return Either.gen(function* () {
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
    })
  }

  if (group === 'review' && action === 'request') {
    return Either.gen(function* () {
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
    })
  }

  if (group === 'events' && action === 'stream') {
    return Either.gen(function* () {
      const workspaceId = yield* flag(flags, 'workspace')
      return {
        method: 'GET',
        path: `/v1/events/stream?workspace_id=${encodeURIComponent(workspaceId)}`,
        stream: true,
        label: 'events stream',
      }
    })
  }

  return unknown(argv)
}

export const usage = `acp — Agent Coordination Protocol CLI

  acp workspace list
  acp work create <title> --workspace <id> [--priority <p>] [--description <d>]
  acp work claim <work_id> --worker <id>
  acp work update <work_id> --state <state>
  acp lease request --workspace <id> --holder <id> --kind <k> --uri <u> [--ttl <n>]
  acp lease release <lease_id>
  acp checkpoint create --workspace <id> --work <id> --summary <s>
  acp artifact create --workspace <id> --work <id> --kind <k> [--summary <s>] [--content <c>]
  acp review request --work <id> --by <id> [--reviewer <id>]
  acp events stream --workspace <id>

Targets ACP_BASE_URL (default http://localhost:$ACP_PORT).`
