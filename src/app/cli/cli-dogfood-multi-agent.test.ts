/**
 * @Acp.App.Cli.DogfoodMultiAgent.Test — drives the real CLI command layer
 * (parseArgs → runCliRequest) end to end against a live ephemeral socket, with
 * four racing agent identities across the full v0.1 loop. This is the CI-safe
 * twin of scripts/acp-cli-dogfood-multi-agent.mjs (which spawns the compiled
 * binary): no dist build and no tsx are needed, so it is a permanent regression
 * guard on the CLI. See wiki/references/cli-dogfood-multi-agent.md.
 */
import { describe, expect, it } from 'vitest'
import { HttpServer } from '@effect/platform'
import { NodeHttpClient } from '@effect/platform-node'
import { Effect, Either } from 'effect'
import { nodeHttpServerLayer } from '../../infrastructure/platform-node/index.js'
import { HttpAppLive } from '../server/http-app.js'
import { parseArgs } from './commands.js'
import { runCliRequest } from './client.js'

const EphemeralServerLive = nodeHttpServerLayer(0)

interface CliOutcome {
  readonly ok: boolean
  readonly status: number
  readonly payload: unknown
}

// Run one `acp` command exactly as the binary does — parse the argv a user would
// type, then send it with the same client main.ts uses. Bad argv is a test bug,
// not a protocol outcome, so it throws; HTTP status is surfaced for the caller.
const runCli = (
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

const expectOk = async (
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

const onLiveServer = <A>(use: (baseUrl: string) => Promise<A>) =>
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

// parseArgs resolves the command from argv[0]/argv[1] and reads flags/positionals
// from argv.slice(2) — exactly the bare tokens a shell hands the binary after
// `acp`, so `['work','claim',id,'--worker',x]` maps to the `work claim` handler.

const shared = ['workspace:read', 'event:read']
const plannerPerms = [
  ...shared,
  'workspace:write',
  'work:create',
  'checkpoint:create',
  'memory:create',
]
const workerPerms = [
  ...shared,
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
const reviewerPerms = [
  ...shared,
  'memory:read',
  'review:request_changes',
  'review:approve',
]

const requiredEvents = [
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

interface Agent {
  readonly role: string
  readonly workerId: string
  readonly token: string
}

const initAgent = async (
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

interface RaceResult {
  readonly agent: Agent
  readonly kind: 'winner' | 'conflict'
  readonly payload: Record<string, unknown>
}

const classifyRace = (
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
const must = <T>(value: T | undefined, message: string): T => {
  if (value === undefined) throw new Error(message)
  return value
}

describe('multi-agent CLI dogfood', () => {
  it('drives the whole acp CLI through a racing planner/worker/reviewer loop', async () => {
    const summary = await onLiveServer(async (baseUrl) => {
      const runId = 'clitest'

      const [planner, workerA, workerB, reviewer] = await Promise.all([
        initAgent(baseUrl, runId, 'planner', plannerPerms, [
          'supports_checkpoints',
          'supports_leases',
        ]),
        initAgent(baseUrl, runId, 'worker_a', workerPerms, [
          'can_edit_files',
          'supports_leases',
        ]),
        initAgent(baseUrl, runId, 'worker_b', workerPerms, [
          'can_edit_files',
          'supports_leases',
        ]),
        initAgent(baseUrl, runId, 'reviewer', reviewerPerms, ['can_review']),
      ])

      const workspace = await expectOk(
        baseUrl,
        'workspace create',
        [
          'workspace',
          'create',
          '--name',
          `acp/cli-dogfood-${runId}`,
          '--kind',
          'git_repository',
          '--uri',
          'git+https://github.com/chrismichaelps/acp.git',
          '--default-branch',
          'main',
        ],
        planner.token,
      )
      const work = await expectOk(
        baseUrl,
        'work create',
        [
          'work',
          'create',
          `Multi-agent CLI dogfood ${runId}`,
          '--workspace',
          workspace.id as string,
          '--priority',
          'high',
          '--description',
          'Exercise the acp CLI with racing agents.',
        ],
        planner.token,
      )
      const workId = work.id as string
      const workspaceId = workspace.id as string

      const plannerCheckpoint = await expectOk(
        baseUrl,
        'planner checkpoint',
        [
          'checkpoint',
          'create',
          '--workspace',
          workspaceId,
          '--work',
          workId,
          '--summary',
          'Planner opened the work item.',
        ],
        planner.token,
      )
      await expectOk(
        baseUrl,
        'planner memory',
        [
          'memory',
          'create',
          '--workspace',
          workspaceId,
          '--work',
          workId,
          '--kind',
          'decision',
          '--key',
          `cli.${runId}.plan`,
          '--summary',
          'Planner chose a shared worktree lease race.',
          '--content',
          `Plan ${runId}.`,
          '--labels',
          'dogfood,cli',
        ],
        planner.token,
      )

      // claim race — exactly one winner, one conflict
      const claims = await Promise.all([
        runCli(
          baseUrl,
          ['work', 'claim', workId, '--worker', workerA.workerId],
          workerA.token,
        ).then((r) => classifyRace(workerA, r, 'claim_conflict')),
        runCli(
          baseUrl,
          ['work', 'claim', workId, '--worker', workerB.workerId],
          workerB.token,
        ).then((r) => classifyRace(workerB, r, 'claim_conflict')),
      ])
      expect(claims.filter((r) => r.kind === 'winner')).toHaveLength(1)
      const claimWinner = must(
        claims.find((r) => r.kind === 'winner'),
        'no claim winner',
      )
      const claimConflict = must(
        claims.find((r) => r.kind === 'conflict'),
        'no claim conflict',
      )
      const activeWorker = claimWinner.agent

      const running = await expectOk(
        baseUrl,
        'work running',
        ['work', 'update', workId, '--state', 'running'],
        activeWorker.token,
      )
      expect(running.state).toBe('running')

      // lease race on the same resource
      const leaseArgv = (holder: string) => [
        'lease',
        'request',
        '--workspace',
        workspaceId,
        '--holder',
        holder,
        '--kind',
        'worktree',
        '--uri',
        `worktree://cli-dogfood/${runId}`,
        '--ttl',
        '900',
      ]
      const leases = await Promise.all([
        runCli(
          baseUrl,
          leaseArgv(activeWorker.workerId),
          activeWorker.token,
        ).then((r) => classifyRace(activeWorker, r, 'lease_conflict')),
        runCli(
          baseUrl,
          leaseArgv(claimConflict.agent.workerId),
          claimConflict.agent.token,
        ).then((r) => classifyRace(claimConflict.agent, r, 'lease_conflict')),
      ])
      expect(leases.filter((r) => r.kind === 'winner')).toHaveLength(1)
      expect(leases.some((r) => r.kind === 'conflict')).toBe(true)
      const leaseWinner = must(
        leases.find((r) => r.kind === 'winner'),
        'no lease winner',
      )
      const leaseHolder = leaseWinner.agent
      const leaseId = leaseWinner.payload.id as string

      const renewed = await expectOk(
        baseUrl,
        'lease renew',
        ['lease', 'renew', leaseId, '--ttl', '900'],
        leaseHolder.token,
      )
      expect(renewed.state).toBe('active')
      const activeLeases = (
        await runCli(
          baseUrl,
          ['lease', 'list', '--workspace', workspaceId],
          reviewer.token,
        )
      ).payload as { id: string; state: string }[]
      expect(activeLeases.find((l) => l.id === leaseId)?.state).toBe('active')

      // worker publishes the handoff surface
      const workerCheckpoint = await expectOk(
        baseUrl,
        'worker checkpoint',
        [
          'checkpoint',
          'create',
          '--workspace',
          workspaceId,
          '--work',
          workId,
          '--summary',
          'Worker implemented the task.',
        ],
        activeWorker.token,
      )
      const handoffMemory = await expectOk(
        baseUrl,
        'handoff memory',
        [
          'memory',
          'create',
          '--workspace',
          workspaceId,
          '--work',
          workId,
          '--kind',
          'handoff',
          '--key',
          `cli.${runId}.handoff`,
          '--summary',
          'Worker handed off context.',
          '--content',
          `Handoff ${runId}.`,
          '--labels',
          'dogfood,handoff',
        ],
        activeWorker.token,
      )
      const artifact = await expectOk(
        baseUrl,
        'artifact create',
        [
          'artifact',
          'create',
          '--workspace',
          workspaceId,
          '--work',
          workId,
          '--kind',
          'test_report',
          '--uri',
          `acp://dogfood/cli/${runId}/report`,
          '--summary',
          'CLI dogfood report.',
        ],
        activeWorker.token,
      )

      // reviewer reads the handoff back
      const latest = await expectOk(
        baseUrl,
        'checkpoint latest',
        ['checkpoint', 'latest', '--work', workId],
        reviewer.token,
      )
      expect(latest.id).toBe(workerCheckpoint.id)
      const handoffRecords = (
        await runCli(
          baseUrl,
          [
            'memory',
            'list',
            '--workspace',
            workspaceId,
            '--work',
            workId,
            '--kind',
            'handoff',
          ],
          reviewer.token,
        )
      ).payload as unknown[]
      expect(handoffRecords).toHaveLength(1)

      // review gate with a changes-requested round trip
      const firstReview = await expectOk(
        baseUrl,
        'review request',
        [
          'review',
          'request',
          '--work',
          workId,
          '--by',
          activeWorker.workerId,
          '--reviewer',
          reviewer.workerId,
        ],
        activeWorker.token,
      )
      const changes = await expectOk(
        baseUrl,
        'review request-changes',
        ['review', 'request-changes', firstReview.id as string],
        reviewer.token,
      )
      expect(changes.state).toBe('changes_requested')
      const resumed = await expectOk(
        baseUrl,
        'work resume',
        ['work', 'update', workId, '--state', 'running'],
        activeWorker.token,
      )
      expect(resumed.state).toBe('running')
      const secondReview = await expectOk(
        baseUrl,
        'review request 2',
        [
          'review',
          'request',
          '--work',
          workId,
          '--by',
          activeWorker.workerId,
          '--reviewer',
          reviewer.workerId,
        ],
        activeWorker.token,
      )
      const approved = await expectOk(
        baseUrl,
        'review approve',
        ['review', 'approve', secondReview.id as string, '--met', 'tests_pass'],
        reviewer.token,
      )
      expect(approved.state).toBe('approved')

      // release and complete
      const released = await runCli(
        baseUrl,
        ['lease', 'release', leaseId],
        leaseHolder.token,
      )
      expect(released.ok).toBe(true)
      const releasedLeases = (
        await runCli(
          baseUrl,
          ['lease', 'list', '--workspace', workspaceId],
          reviewer.token,
        )
      ).payload as { id: string; state: string }[]
      expect(releasedLeases.find((l) => l.id === leaseId)?.state).toBe(
        'released',
      )
      const completed = await expectOk(
        baseUrl,
        'work complete',
        ['work', 'update', workId, '--state', 'completed'],
        activeWorker.token,
      )
      expect(completed.state).toBe('completed')

      // reviewer replays the event log
      const events = (
        await runCli(
          baseUrl,
          ['events', 'list', '--workspace', workspaceId, '--after', '0'],
          reviewer.token,
        )
      ).payload as { type: string; seq: number }[]
      const types = events.map((e) => e.type)
      for (const required of requiredEvents) {
        expect(types, `missing replayed event ${required}`).toContain(required)
      }
      const monotonic = events.every(
        (e, i) => i === 0 || e.seq > events[i - 1].seq,
      )
      expect(monotonic).toBe(true)

      return {
        claimWinner: activeWorker.workerId,
        claimConflict: claimConflict.agent.workerId,
        leaseWinner: leaseHolder.workerId,
        plannerCheckpointId: plannerCheckpoint.id,
        handoffMemoryId: handoffMemory.id,
        artifactId: artifact.id,
        firstReviewState: changes.state,
        secondReviewState: approved.state,
        completedState: completed.state,
        events: events.length,
      }
    })

    expect(summary.claimWinner).not.toBe(summary.claimConflict)
    expect(summary.firstReviewState).toBe('changes_requested')
    expect(summary.secondReviewState).toBe('approved')
    expect(summary.completedState).toBe('completed')
    expect(summary.events).toBeGreaterThanOrEqual(requiredEvents.length)
  })
})
