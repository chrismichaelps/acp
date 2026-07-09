/** @Acp.App.Cli.GhBridge — `acp gh` bridge orchestration */
import type { HttpClient } from '@effect/platform'
import { Config, Effect } from 'effect'
import {
  GitHubGateway,
  type GitHubError,
  type MergeMethod,
  parsePrRef,
} from '../../infrastructure/github/index.js'
import { acpGet, acpPost, BridgeError } from './gh-bridge-support.js'
import {
  acpCommentsAwaitingGithubPost,
  acpCommentsAwaitingResolvePropagation,
  buildExternalIdIndex,
  evaluateMergeGate,
  formatDecision,
  githubCommentsAwaitingAcpImport,
  toAcpImportPayload,
  toGitHubSide,
  type WireComment,
  type WireResume,
} from './gh-reconcile.js'

interface WorkWire {
  readonly workspace_id: string
}

const syncPr = (
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
    const reviewId = yield* requireFlag(flags, 'review')
    const artifactId = yield* requireFlag(flags, 'artifact')

    const gh = yield* GitHubGateway
    const pull = yield* gh.fetchPullRequest(ref)
    const githubComments = yield* gh.listReviewComments(ref)

    const comments = (yield* acpGet(
      ctx.baseUrl,
      ctx.token,
      `/v1/work/${workId}/review-comments`,
    )) as readonly WireComment[]

    // ACP -> GitHub: post unstamped ACP-origin comments, then stamp them.
    const unsynced = acpCommentsAwaitingGithubPost(comments)
    for (const comment of unsynced) {
      const created = yield* gh.postReviewComment(ref, {
        path: comment.target.file,
        line: comment.target.line,
        side: toGitHubSide(comment.target.side),
        body: comment.body,
        commit_id: pull.head_sha,
      })
      yield* acpPost(
        ctx.baseUrl,
        ctx.token,
        `/v1/review-comments/${comment.id}/external-id`,
        { external_id: created.id },
      )
    }

    // GitHub -> ACP: import GitHub comments not yet mirrored into ACP.
    const mirroredExternalIds = buildExternalIdIndex(comments)
    const workspace = (yield* acpGet(
      ctx.baseUrl,
      ctx.token,
      `/v1/work/${workId}`,
    )) as WorkWire
    const unimported = githubCommentsAwaitingAcpImport(
      githubComments,
      mirroredExternalIds,
    )
    for (const ghComment of unimported) {
      yield* acpPost(
        ctx.baseUrl,
        ctx.token,
        `/v1/reviews/${reviewId}/comments`,
        toAcpImportPayload(ghComment, {
          review_id: reviewId,
          work_id: workId,
          workspace_id: workspace.workspace_id,
          artifact_id: artifactId,
        }),
      )
    }

    // Resolve propagation: best-effort, every resolved+stamped ACP comment.
    const toResolve = acpCommentsAwaitingResolvePropagation(comments)
    for (const comment of toResolve) {
      if (comment.external_id === null || comment.external_id === undefined) {
        continue
      }
      yield* gh.resolveReviewThread(ref, comment.external_id)
    }

    return yield* Effect.void
  })

interface GhFlags {
  readonly work?: string
  readonly workspace?: string
  readonly method?: string
  readonly review?: string
  readonly artifact?: string
}

const FLAG_NAMES = [
  'work',
  'workspace',
  'method',
  'review',
  'artifact',
] as const

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

const MERGE_METHODS = ['squash', 'merge', 'rebase'] as const

const resolveMergeMethod = (
  raw: string | undefined,
): Effect.Effect<MergeMethod, BridgeError> => {
  const value = raw ?? 'squash'
  return (MERGE_METHODS as readonly string[]).includes(value)
    ? Effect.succeed(value as MergeMethod)
    : Effect.fail(
        new BridgeError({
          message: `invalid --method: ${value} (expected squash|merge|rebase)`,
        }),
      )
}

/**
 * Post the ACP decision as a PR issue comment, then merge only if the read-only
 * gate is satisfied (review approved, grill passed, no open comments). The gate
 * never mutates ACP state; a blocked merge fails without calling gateway.merge.
 */
const mergePr = (
  ctx: BridgeContext,
): Effect.Effect<
  void,
  BridgeError | GitHubError,
  GitHubGateway | HttpClient.HttpClient
> =>
  Effect.gen(function* () {
    const ref = yield* parsePrRef(ctx.argv[2])
    const flags = parseGhFlags(ctx.argv.slice(3))
    const workId = yield* requireFlag(flags, 'work')
    const method = yield* resolveMergeMethod(flags.method)

    const gh = yield* GitHubGateway
    const resume = (yield* acpGet(
      ctx.baseUrl,
      ctx.token,
      `/v1/work/${workId}/resume`,
    )) as WireResume

    yield* gh.postIssueComment(ref, formatDecision(resume))

    const gate = evaluateMergeGate(resume)
    if (!gate.ok) {
      return yield* Effect.fail(
        new BridgeError({
          message: `merge blocked: ${gate.reasons.join('; ')}`,
        }),
      )
    }

    yield* gh.merge(ref, method)
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
    if (subcommand === 'sync') return yield* syncPr(ctx)
    if (subcommand === 'merge') return yield* mergePr(ctx)
    return yield* Effect.fail(
      new BridgeError({ message: `unknown gh subcommand: ${subcommand}` }),
    )
  })
