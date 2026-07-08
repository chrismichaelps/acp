/**
 * @Acp.App.Cli.DogfoodSupport — shared harness for the multi-agent CLI dogfood
 * test. Holds the live-socket boot, the CLI command driver (real parseArgs +
 * runCliRequest), race classification, and the agent/permission/event fixtures,
 * so cli-dogfood-multi-agent.test.ts stays a readable lifecycle script under the
 * file-size gate. See wiki/references/cli-dogfood-multi-agent.md.
 */
import { HttpServer } from '@effect/platform'
import { NodeHttpClient } from '@effect/platform-node'
import { Effect, Either } from 'effect'
import { nodeHttpServerLayer } from '../../infrastructure/platform-node/index.js'
import { HttpAppLive } from '../server/http-app.js'
import { parseArgs } from './commands.js'
import { runCliRequest } from './client.js'

const EphemeralServerLive = nodeHttpServerLayer(0)

export interface CliOutcome {
  readonly ok: boolean
  readonly status: number
  readonly payload: unknown
}

// Run one `acp` command exactly as the binary does — parse the bare argv a user
// types (parseArgs resolves the command from argv[0]/argv[1] and reads
// flags/positionals from argv.slice(2)), then send it with the same client
// main.ts uses. Bad argv is a test bug, not a protocol outcome, so it throws.
export const runCli = (
  baseUrl: string,
  argv: readonly string[],
  token = '',
): Promise<CliOutcome> => {
  const parsed = parseArgs(argv)
  if (Either.isLeft(parsed)) {
    throw new Error(
      `unparseable argv: ${argv.join(' ')} (${parsed.left.message})`,
    )
  }
  return Effect.runPromise(
    runCliRequest(parsed.right, baseUrl, token).pipe(
      Effect.provide(NodeHttpClient.layer),
    ),
  ).then((result) => ({
    ok: result.status < 400,
    status: result.status,
    payload:
      result.body === '' ? undefined : (JSON.parse(result.body) as unknown),
  }))
}

export const expectOk = async (
  baseUrl: string,
  label: string,
  argv: readonly string[],
  token: string,
): Promise<Record<string, unknown>> => {
  const result = await runCli(baseUrl, argv, token)
  if (!result.ok) {
    throw new Error(
      `${label} failed (${String(result.status)}): ${JSON.stringify(result.payload)}`,
    )
  }
  return result.payload as Record<string, unknown>
}

export const onLiveServer = <A>(use: (baseUrl: string) => Promise<A>) =>
  Effect.runPromise(
    HttpServer.addressWith((address) => {
      const port = address._tag === 'TcpAddress' ? address.port : 0
      return Effect.promise(() => use(`http://127.0.0.1:${port.toString()}`))
    }).pipe(
      Effect.provide(HttpAppLive),
      Effect.provide(EphemeralServerLive),
      Effect.scoped,
    ),
  )

const shared = ['workspace:read', 'event:read']
export const plannerPerms = [
  ...shared,
  'workspace:write',
  'work:create',
  'checkpoint:create',
  'memory:create',
]
export const workerPerms = [
  ...shared,
  'workspace:write',
  'work:claim',
  'work:update',
  'lease:create',
  'lease:renew',
  'lease:release',
  'checkpoint:create',
  'memory:create',
  'memory:read',
  'artifact:create',
  'review:create',
]
export const reviewerPerms = [
  ...shared,
  'workspace:write',
  'memory:read',
  'review:request_changes',
  'review:approve',
]

export const requiredEvents = [
  'work.created',
  'checkpoint.created',
  'memory.created',
  'work.claimed',
  'work.started',
  'lease.granted',
  'lease.renewed',
  'review.requested',
  'review.changes_requested',
  'work.unblocked',
  'review.approved',
  'lease.released',
  'work.completed',
]

export interface Agent {
  readonly role: string
  readonly workerId: string
  readonly token: string
}

export interface GrillRoundInput {
  readonly reviewer: Agent
  readonly worker: Agent
  readonly reviewId: string
  readonly workId: string
  readonly workspaceId: string
  readonly artifactId: string
  readonly accept: boolean
  readonly resolveComment: boolean
  readonly label: string
}

export interface GrillRoundResult {
  readonly comment: Record<string, unknown>
  readonly grill: Record<string, unknown>
  readonly evaluation: Record<string, unknown>
}

// Drive one full review-gate round through the real CLI: a diff-anchored
// comment, a blocker grill (open → ask → answer → verdict), an optional comment
// resolve, then the gate evaluation. The reviewer authors the gate; the worker
// answers the question. `accept` picks the verdict and `resolveComment` decides
// whether the comment is cleared before evaluation, so a caller can shape a
// passing or failing outcome.
export const driveGrillRound = async (
  baseUrl: string,
  input: GrillRoundInput,
): Promise<GrillRoundResult> => {
  const { reviewer, worker, reviewId, workId, workspaceId, artifactId, label } =
    input
  const comment = await expectOk(
    baseUrl,
    `${label} comment`,
    [
      'review',
      'comment',
      '--review',
      reviewId,
      '--work',
      workId,
      '--workspace',
      workspaceId,
      '--artifact',
      artifactId,
      '--file',
      'src/app.ts',
      '--side',
      'new',
      '--body',
      `${label} round question.`,
    ],
    reviewer.token,
  )
  const grill = await expectOk(
    baseUrl,
    `${label} grill open`,
    [
      'grill',
      'open',
      '--review',
      reviewId,
      '--work',
      workId,
      '--workspace',
      workspaceId,
    ],
    reviewer.token,
  )
  const question = await expectOk(
    baseUrl,
    `${label} grill ask`,
    [
      'grill',
      'ask',
      grill.id as string,
      '--severity',
      'blocker',
      '--prompt',
      `${label} blocker prompt.`,
    ],
    reviewer.token,
  )
  await expectOk(
    baseUrl,
    `${label} grill answer`,
    ['grill', 'answer', question.id as string, '--answer', `${label} answer.`],
    worker.token,
  )
  await expectOk(
    baseUrl,
    `${label} grill verdict`,
    [
      'grill',
      'verdict',
      question.id as string,
      input.accept ? '--accept' : '--reject',
    ],
    reviewer.token,
  )
  if (input.resolveComment) {
    await expectOk(
      baseUrl,
      `${label} comment resolve`,
      ['review', 'comment', 'resolve', comment.id as string],
      reviewer.token,
    )
  }
  const evaluation = await expectOk(
    baseUrl,
    `${label} grill evaluate`,
    ['grill', 'evaluate', grill.id as string],
    reviewer.token,
  )
  return { comment, grill, evaluation }
}

export const initAgent = async (
  baseUrl: string,
  runId: string,
  role: string,
  perms: readonly string[],
  caps: readonly string[],
): Promise<Agent> => {
  const workerId = `agent_cli_${role}_${runId}`.replace(/[^a-zA-Z0-9_]/g, '_')
  const session = await expectOk(
    baseUrl,
    `session init (${role})`,
    [
      'session',
      'init',
      '--worker',
      workerId,
      '--name',
      `CLI ${role}`,
      '--kind',
      'agent',
      '--vendor',
      'anthropic',
      '--capabilities',
      caps.join(','),
      '--permissions',
      perms.join(','),
    ],
    '',
  )
  return { role, workerId, token: session.session_id as string }
}

export interface RaceResult {
  readonly agent: Agent
  readonly kind: 'winner' | 'conflict'
  readonly payload: Record<string, unknown>
}

export const classifyRace = (
  agent: Agent,
  result: CliOutcome,
  conflictCode: string,
): RaceResult => {
  if (result.ok)
    return {
      agent,
      kind: 'winner',
      payload: result.payload as Record<string, unknown>,
    }
  const payload = result.payload as { error?: { code?: string } } | undefined
  if (payload?.error?.code === conflictCode) {
    return { agent, kind: 'conflict', payload }
  }
  throw new Error(
    `unexpected race result for ${agent.role}: ${JSON.stringify(result.payload)}`,
  )
}

// Narrow an Array.find result without a non-null assertion; a missing winner or
// conflict is a real protocol regression, so surface it as a thrown failure.
export const must = <T>(value: T | undefined, message: string): T => {
  if (value === undefined) throw new Error(message)
  return value
}
