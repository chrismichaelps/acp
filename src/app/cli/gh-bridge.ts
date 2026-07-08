/** @Acp.App.Cli.GhBridge — `acp gh` bridge orchestration */
import type { HttpClient } from '@effect/platform'
import { Config, Effect } from 'effect'
import {
  GitHubGateway,
  type GitHubError,
  parsePrRef,
} from '../../infrastructure/github/index.js'
import { acpPost, BridgeError } from './gh-bridge-support.js'

interface GhFlags {
  readonly work?: string
  readonly workspace?: string
  readonly method?: string
}

const FLAG_NAMES = ['work', 'workspace', 'method'] as const

const parseGhFlags = (argv: readonly string[]): GhFlags => {
  const flags: Record<string, string> = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    if (!(FLAG_NAMES as readonly string[]).includes(key)) continue
    flags[key] = argv[index + 1]
  }
  return flags
}

const requireFlag = (
  flags: GhFlags,
  key: keyof GhFlags,
): Effect.Effect<string, BridgeError> => {
  const value = flags[key]
  return value === undefined
    ? Effect.fail(new BridgeError({ message: `missing required --${key}` }))
    : Effect.succeed(value)
}

interface BridgeContext {
  readonly argv: readonly string[]
  readonly baseUrl: string
  readonly token: string
}

const importPr = (
  ctx: BridgeContext,
): Effect.Effect<
  void,
  BridgeError | GitHubError,
  GitHubGateway | HttpClient.HttpClient
> =>
  Effect.gen(function* () {
    const refInput = ctx.argv[2]
    const ref = yield* parsePrRef(refInput)
    const flags = parseGhFlags(ctx.argv.slice(3))
    const workId = yield* requireFlag(flags, 'work')
    const workspaceId = yield* requireFlag(flags, 'workspace')

    const gh = yield* GitHubGateway
    const pull = yield* gh.fetchPullRequest(ref)
    const diff = yield* gh.fetchDiff(ref)

    yield* acpPost(ctx.baseUrl, ctx.token, '/v1/artifacts', {
      workspace_id: workspaceId,
      work_id: workId,
      kind: 'diff',
      uri: pull.url,
      content: diff,
    })
    yield* acpPost(ctx.baseUrl, ctx.token, '/v1/artifacts', {
      workspace_id: workspaceId,
      work_id: workId,
      kind: 'pull_request',
      uri: pull.url,
      summary: pull.title,
    })

    return yield* Effect.void
  })

export const runGhBridge = (
  argv: readonly string[],
): Effect.Effect<
  void,
  BridgeError | GitHubError,
  GitHubGateway | HttpClient.HttpClient
> =>
  Effect.gen(function* () {
    const configuredBaseUrl = yield* Config.string('ACP_BASE_URL').pipe(
      Config.withDefault(''),
      Effect.orDie,
    )
    const port = yield* Config.integer('ACP_PORT').pipe(
      Config.withDefault(4317),
      Effect.orDie,
    )
    const baseUrl =
      configuredBaseUrl === ''
        ? `http://localhost:${String(port)}`
        : configuredBaseUrl
    const token = yield* Config.string('ACP_RPC_TOKEN').pipe(
      Config.withDefault(''),
      Effect.orDie,
    )

    const ctx: BridgeContext = { argv, baseUrl, token }
    const subcommand = argv[1]

    if (subcommand === 'import') return yield* importPr(ctx)
    if (subcommand === 'sync') return yield* Effect.die('Task 8')
    if (subcommand === 'merge') return yield* Effect.die('Task 9')
    return yield* Effect.fail(
      new BridgeError({ message: `unknown gh subcommand: ${subcommand}` }),
    )
  })
