#!/usr/bin/env node
/**
 * Multi-agent dogfood that drives the REAL compiled `acp` CLI binary end to end.
 *
 * Unlike acp-codex-dogfood-multi-agent.mjs (which `fetch`es the HTTP surface),
 * this lane spawns `dist/app/cli/main.js` once per command — proving the shipped
 * binary, its ACP_BASE_URL/ACP_PORT/ACP_RPC_TOKEN env contract, its stdout/stderr
 * split, and its process exit codes. Four agent identities (planner, two workers,
 * a reviewer) race and hand off across the full v0.1 loop using only `acp`
 * subcommands.
 *
 * If ACP_BASE_URL is set it targets that host; otherwise it self-boots the
 * compiled `dist/app/server/main.js` on a free port and tears it down at the end.
 * Run `npm run build` first. See wiki/references/cli-dogfood-multi-agent.md.
 */
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

const here = dirname(fileURLToPath(import.meta.url))
const distCli = resolve(here, '../dist/app/cli/main.js')
const distServer = resolve(here, '../dist/app/server/main.js')

const runId = process.env.ACP_DOGFOOD_RUN_ID ?? Date.now().toString(36)
const workspaceId = process.env.ACP_DOGFOOD_WORKSPACE_ID?.trim() || undefined

const assert = (condition, message) => {
  if (!condition) throw new Error(`assertion failed: ${message}`)
}

// --- free-port + server self-boot -----------------------------------------

const freePort = async () => {
  const probe = createServer()
  probe.listen(0)
  await once(probe, 'listening')
  const { port } = probe.address()
  await new Promise((done) => probe.close(done))
  return port
}

// Readiness = the socket answers HTTP at all. HttpAppLive mounts no root
// liveness route (the legacy `/health` lives behind the `/v1` seam), so any
// resolved response — even a 404 — proves the server is up; only a connection
// refusal means "not yet".
const waitForHealth = async (baseUrl) => {
  const deadline = Date.now() + 15_000
  for (;;) {
    try {
      await globalThis.fetch(baseUrl, { method: 'GET' })
      return
    } catch {
      // connection refused — server not up yet
    }
    if (Date.now() > deadline) throw new Error('server did not become ready')
    await delay(100)
  }
}

const bootServer = async () => {
  const port = await freePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const child = spawn(process.execPath, [distServer], {
    env: { ...process.env, ACP_PORT: String(port), ACP_BASE_URL: '' },
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  child.on('error', (error) => {
    console.error(`server process error: ${error.message}`)
    process.exitCode = 1
  })
  await waitForHealth(baseUrl)
  return {
    baseUrl,
    stop: () => {
      child.kill('SIGTERM')
      return Promise.race([once(child, 'exit'), delay(2000)])
    },
  }
}

// --- CLI driver ------------------------------------------------------------

/**
 * Spawn the real `acp` binary. Returns { ok, payload, stdout, stderr, code }.
 * On success the CLI prints the JSON body to stdout and exits 0; on an HTTP
 * error it prints the JSON body to stderr and exits non-zero.
 */
const runCli = (baseUrl, argv, token = '') =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [distCli, ...argv], {
      env: {
        ...process.env,
        ACP_BASE_URL: baseUrl,
        ACP_RPC_TOKEN: token,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('error', rejectPromise)
    child.on('close', (code) => {
      const payload = parsePayload(stdout, stderr)
      resolvePromise({ ok: code === 0, payload, stdout, stderr, code })
    })
  })

// On success the CLI prints the compact JSON body to stdout. On an HTTP error it
// prints the JSON body to stderr AND NodeRuntime logs a second pino JSON line for
// the CliError, so stderr holds two JSON objects. Parse line by line and prefer
// the object that carries the protocol `error` payload over the pino log line.
const tryJson = (line) => {
  try {
    return JSON.parse(line.trim())
  } catch {
    return undefined
  }
}

const parsePayload = (stdout, stderr) => {
  const stdoutPayload = tryJson(stdout)
  if (stdoutPayload !== undefined) return stdoutPayload
  const candidates = stderr
    .split('\n')
    .map(tryJson)
    .filter((value) => value !== undefined)
  return (
    candidates.find(
      (value) => value && typeof value === 'object' && 'error' in value,
    ) ?? candidates[0]
  )
}

const expectOk = async (cli, label, argv, token) => {
  const result = await cli(argv, token)
  assert(
    result.ok,
    `${label} exited ${result.code}: ${result.stderr || result.stdout}`,
  )
  assert(result.payload !== undefined, `${label} produced no JSON payload`)
  return result.payload
}

// --- lifecycle -------------------------------------------------------------

const sharedPermissions = ['workspace:read', 'event:read']
const plannerPermissions = [
  ...sharedPermissions,
  'workspace:write',
  'work:create',
  'checkpoint:create',
  'memory:create',
]
const workerPermissions = [
  ...sharedPermissions,
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
const reviewerPermissions = [
  ...sharedPermissions,
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

const safeWorkerId = (role) =>
  `agent_cli_${role}_${runId}`.replace(/[^a-zA-Z0-9_]/g, '_')

const initAgent = async (cli, role, permissions, capabilities) => {
  const workerId = safeWorkerId(role)
  const argv = [
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
    capabilities.join(','),
    '--permissions',
    permissions.join(','),
  ]
  const session = await expectOk(cli, `session init (${role})`, argv, '')
  return { role, workerId, token: session.session_id }
}

const classifyRace = (agent, result, conflictCode) => {
  if (result.ok) return { agent, kind: 'winner', payload: result.payload }
  if (result.payload?.error?.code === conflictCode) {
    return { agent, kind: 'conflict', payload: result.payload }
  }
  throw new Error(
    `unexpected ${conflictCode} race result for ${agent.role}: code ${result.code} ${result.stderr}`,
  )
}

const run = async (baseUrl) => {
  const cli = (argv, token) => runCli(baseUrl, argv, token)

  const [planner, workerA, workerB, reviewer] = await Promise.all([
    initAgent(cli, 'planner', plannerPermissions, [
      'supports_checkpoints',
      'supports_leases',
    ]),
    initAgent(cli, 'worker_a', workerPermissions, [
      'can_edit_files',
      'can_run_commands',
      'supports_leases',
    ]),
    initAgent(cli, 'worker_b', workerPermissions, [
      'can_edit_files',
      'can_run_commands',
      'supports_leases',
    ]),
    initAgent(cli, 'reviewer', reviewerPermissions, ['can_review']),
  ])

  const workspace =
    workspaceId === undefined
      ? await expectOk(
          cli,
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
      : { id: workspaceId }

  const work = await expectOk(
    cli,
    'work create',
    [
      'work',
      'create',
      `Multi-agent CLI dogfood ${runId}`,
      '--workspace',
      workspace.id,
      '--priority',
      'high',
      '--description',
      'Exercise the acp CLI with racing planner/worker/reviewer agents.',
    ],
    planner.token,
  )

  const plannerCheckpoint = await expectOk(
    cli,
    'planner checkpoint',
    [
      'checkpoint',
      'create',
      '--workspace',
      workspace.id,
      '--work',
      work.id,
      '--summary',
      'Planner opened the shared work item.',
    ],
    planner.token,
  )
  await expectOk(
    cli,
    'planner memory',
    [
      'memory',
      'create',
      '--workspace',
      workspace.id,
      '--work',
      work.id,
      '--kind',
      'decision',
      '--key',
      `cli.${runId}.plan`,
      '--summary',
      'Planner chose a shared worktree lease race.',
      '--content',
      `Plan for run ${runId}.`,
      '--labels',
      'dogfood,cli,multi-agent',
    ],
    planner.token,
  )

  // --- claim race: exactly one winner, one conflict
  const claimResults = await Promise.all([
    cli(
      ['work', 'claim', work.id, '--worker', workerA.workerId],
      workerA.token,
    ).then((r) => classifyRace(workerA, r, 'claim_conflict')),
    cli(
      ['work', 'claim', work.id, '--worker', workerB.workerId],
      workerB.token,
    ).then((r) => classifyRace(workerB, r, 'claim_conflict')),
  ])
  const claimWinner = claimResults.find((r) => r.kind === 'winner')
  const claimConflict = claimResults.find((r) => r.kind === 'conflict')
  assert(
    claimResults.filter((r) => r.kind === 'winner').length === 1,
    'expected exactly one claim winner',
  )
  assert(claimConflict !== undefined, 'expected exactly one claim conflict')

  const activeWorker = claimWinner.agent
  const running = await expectOk(
    cli,
    'work running',
    ['work', 'update', work.id, '--state', 'running'],
    activeWorker.token,
  )
  assert(running.state === 'running', 'claimed work did not enter running')

  // --- lease race on the same resource
  const leaseArgv = (holder) => [
    'lease',
    'request',
    '--workspace',
    workspace.id,
    '--holder',
    holder,
    '--kind',
    'worktree',
    '--uri',
    `worktree://cli-dogfood/${runId}`,
    '--ttl',
    '900',
  ]
  const leaseResults = await Promise.all([
    cli(leaseArgv(activeWorker.workerId), activeWorker.token).then((r) =>
      classifyRace(activeWorker, r, 'lease_conflict'),
    ),
    cli(
      leaseArgv(claimConflict.agent.workerId),
      claimConflict.agent.token,
    ).then((r) => classifyRace(claimConflict.agent, r, 'lease_conflict')),
  ])
  const leaseWinner = leaseResults.find((r) => r.kind === 'winner')
  assert(
    leaseResults.filter((r) => r.kind === 'winner').length === 1,
    'expected exactly one lease winner',
  )
  assert(
    leaseResults.some((r) => r.kind === 'conflict'),
    'expected exactly one lease conflict',
  )

  const leaseHolder = leaseWinner.agent
  const lease = leaseWinner.payload
  const renewed = await expectOk(
    cli,
    'lease renew',
    ['lease', 'renew', lease.id, '--ttl', '900'],
    leaseHolder.token,
  )
  assert(renewed.state === 'active', 'renewed lease was not active')

  const activeLeases = await expectOk(
    cli,
    'lease list',
    ['lease', 'list', '--workspace', workspace.id],
    reviewer.token,
  )
  const activeLease = activeLeases.find((l) => l.id === lease.id)
  assert(activeLease?.state === 'active', 'lease readback did not show active')

  // --- worker publishes the handoff surface
  const workerCheckpoint = await expectOk(
    cli,
    'worker checkpoint',
    [
      'checkpoint',
      'create',
      '--workspace',
      workspace.id,
      '--work',
      work.id,
      '--summary',
      'Worker implemented the coordinated task.',
    ],
    activeWorker.token,
  )
  const handoffMemory = await expectOk(
    cli,
    'handoff memory',
    [
      'memory',
      'create',
      '--workspace',
      workspace.id,
      '--work',
      work.id,
      '--kind',
      'handoff',
      '--key',
      `cli.${runId}.handoff`,
      '--summary',
      'Worker handed off context for review.',
      '--content',
      `Handoff for run ${runId}.`,
      '--labels',
      'dogfood,cli,handoff',
    ],
    activeWorker.token,
  )
  const artifact = await expectOk(
    cli,
    'artifact create',
    [
      'artifact',
      'create',
      '--workspace',
      workspace.id,
      '--work',
      work.id,
      '--kind',
      'test_report',
      '--uri',
      `acp://dogfood/cli/${runId}/report`,
      '--summary',
      'Multi-agent CLI dogfood report.',
    ],
    activeWorker.token,
  )

  // --- reviewer reads the handoff back
  const latestCheckpoint = await expectOk(
    cli,
    'checkpoint latest',
    ['checkpoint', 'latest', '--work', work.id],
    reviewer.token,
  )
  assert(
    latestCheckpoint.id === workerCheckpoint.id,
    'reviewer did not read latest checkpoint',
  )
  const handoffRecords = await expectOk(
    cli,
    'memory list handoff',
    [
      'memory',
      'list',
      '--workspace',
      workspace.id,
      '--work',
      work.id,
      '--kind',
      'handoff',
    ],
    reviewer.token,
  )
  assert(handoffRecords.length === 1, 'reviewer did not read handoff memory')

  // --- review gate with a changes-requested round trip
  const firstReview = await expectOk(
    cli,
    'review request',
    [
      'review',
      'request',
      '--work',
      work.id,
      '--by',
      activeWorker.workerId,
      '--reviewer',
      reviewer.workerId,
    ],
    activeWorker.token,
  )
  const changes = await expectOk(
    cli,
    'review request-changes',
    ['review', 'request-changes', firstReview.id],
    reviewer.token,
  )
  assert(
    changes.state === 'changes_requested',
    'reviewer did not request changes',
  )

  const resumed = await expectOk(
    cli,
    'work resume',
    ['work', 'update', work.id, '--state', 'running'],
    activeWorker.token,
  )
  assert(resumed.state === 'running', 'work did not resume after changes')

  const secondReview = await expectOk(
    cli,
    'review request 2',
    [
      'review',
      'request',
      '--work',
      work.id,
      '--by',
      activeWorker.workerId,
      '--reviewer',
      reviewer.workerId,
    ],
    activeWorker.token,
  )
  const approved = await expectOk(
    cli,
    'review approve',
    ['review', 'approve', secondReview.id, '--met', 'tests_pass'],
    reviewer.token,
  )
  assert(approved.state === 'approved', 'reviewer did not approve')

  // --- release lease and complete
  const released = await cli(['lease', 'release', lease.id], leaseHolder.token)
  assert(released.ok, `lease release failed: ${released.stderr}`)
  const releasedLeases = await expectOk(
    cli,
    'lease list 2',
    ['lease', 'list', '--workspace', workspace.id],
    reviewer.token,
  )
  const releasedLease = releasedLeases.find((l) => l.id === lease.id)
  assert(
    releasedLease?.state === 'released',
    'lease readback did not show released',
  )

  const completed = await expectOk(
    cli,
    'work complete',
    ['work', 'update', work.id, '--state', 'completed'],
    activeWorker.token,
  )
  assert(completed.state === 'completed', 'work did not complete')

  // --- reviewer replays the event log
  const events = await expectOk(
    cli,
    'events list',
    ['events', 'list', '--workspace', workspace.id, '--after', '0'],
    reviewer.token,
  )
  const types = events.map((e) => e.type)
  for (const required of requiredEvents) {
    assert(types.includes(required), `missing replayed event ${required}`)
  }
  const monotonic = events.every((e, i) => i === 0 || e.seq > events[i - 1].seq)
  assert(monotonic, 'event sequence is not strictly monotonic')

  return {
    ok: true,
    base_url: baseUrl,
    run_id: runId,
    workspace_id: workspace.id,
    work_id: work.id,
    claim_winner: activeWorker.workerId,
    claim_conflict: claimConflict.agent.workerId,
    lease_winner: leaseHolder.workerId,
    lease_state_after_readback: activeLease.state,
    lease_state_after_release: releasedLease.state,
    planner_checkpoint_id: plannerCheckpoint.id,
    worker_checkpoint_id: workerCheckpoint.id,
    handoff_memory_id: handoffMemory.id,
    artifact_id: artifact.id,
    first_review_state: changes.state,
    second_review_state: approved.state,
    completed_state: completed.state,
    replayed_events: events.length,
    event_sequence_monotonic: true,
  }
}

const main = async () => {
  const existing = process.env.ACP_BASE_URL?.replace(/\/$/, '') || ''
  const server =
    existing === ''
      ? await bootServer()
      : { baseUrl: existing, stop: () => Promise.resolve() }
  try {
    const summary = await run(server.baseUrl)
    console.log(JSON.stringify(summary, null, 2))
  } finally {
    await server.stop()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
