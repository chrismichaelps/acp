#!/usr/bin/env node
/**
 * Docker HA dogfood lane: run the Compose self-host-ha profile, drive separate
 * ACP identities through a realistic coordination lifecycle, and prove the
 * Postgres-backed state survives host restarts.
 */
import { spawn } from 'node:child_process'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

const runId = process.env.ACP_DOGFOOD_RUN_ID ?? Date.now().toString(36)
const keepStack = process.env.ACP_DOCKER_HA_KEEP_STACK === 'true'
const skipBuild = process.env.ACP_DOCKER_SKIP_BUILD === 'true'
process.env.ACP_SWEEP_INTERVAL ??= '250 millis'
const composeArgs = ['compose', '--profile', 'ha']

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

const requiredEventTypes = [
  'workspace.created',
  'work.created',
  'checkpoint.created',
  'memory.created',
  'work.claimed',
  'work.started',
  'lease.granted',
  'lease.renewed',
  'artifact.created',
  'review.requested',
  'review.changes_requested',
  'work.unblocked',
  'review.approved',
  'lease.released',
  'work.completed',
]

const run = (command, args, options = {}) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...options.env },
      stdio: options.capture === true ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    })
    let stdout = ''
    let stderr = ''
    if (child.stdout) child.stdout.on('data', (chunk) => (stdout += chunk))
    if (child.stderr) child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('error', rejectPromise)
    child.on('close', (code) => {
      resolvePromise({ code: code ?? 1, stdout, stderr })
    })
  })

const runOk = async (command, args, options = {}) => {
  const result = await run(command, args, options)
  if (result.code === 0) return result
  throw new Error(
    `${command} ${args.join(' ')} exited ${String(result.code)}: ${
      result.stderr || result.stdout
    }`,
  )
}

const docker = (args, options) => runOk('docker', args, options)
const compose = (args, options) => docker([...composeArgs, ...args], options)

const assert = (condition, message) => {
  if (!condition) throw new Error(`assertion failed: ${message}`)
}

const serviceContainerIds = async () => {
  const { stdout } = await compose(['ps', '-q', 'acp-ha'], { capture: true })
  return stdout.split('\n').filter(Boolean)
}

const healthStatuses = async () => {
  const containerIds = await serviceContainerIds()
  return Promise.all(
    containerIds.map(async (containerId) => {
      const inspected = await docker(
        ['inspect', '-f', '{{.State.Health.Status}}', containerId],
        { capture: true },
      ).catch(() => ({ stdout: 'none' }))
      return inspected.stdout.trim()
    }),
  )
}

const waitForHealthy = async (label) => {
  const deadline = Date.now() + 180_000
  for (;;) {
    const statuses = await healthStatuses()
    if (statuses.length > 0 && statuses.every((status) => status === 'healthy'))
      return
    if (Date.now() > deadline) {
      await compose(['logs'], { capture: false }).catch(() => undefined)
      throw new Error(`${label} did not become healthy`)
    }
    await delay(3_000)
  }
}

const restartHost = async (label) => {
  await compose(['restart', 'acp-ha'])
  await waitForHealthy(label)
}

const parsePayload = (text) => {
  const trimmed = text.trim()
  if (trimmed === '') return undefined
  const candidate =
    trimmed
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith('{') || line.startsWith('[')) ?? trimmed
  return JSON.parse(candidate)
}

const cli = async (token, args) => {
  const result = await run('./bin/acp', args, {
    capture: true,
    env: {
      ACP_COMPOSE_SERVICE: 'acp-ha',
      ...(token === '' ? {} : { ACP_RPC_TOKEN: token }),
    },
  })
  const payload = parsePayload(
    result.code === 0 ? result.stdout : result.stderr,
  )
  return {
    ok: result.code === 0,
    code: result.code,
    payload,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

const cliOnContainer = async (containerId, token, args) => {
  const result = await docker(
    [
      'exec',
      '-e',
      'ACP_BASE_URL=http://127.0.0.1:4317',
      '-e',
      `ACP_RPC_TOKEN=${token}`,
      containerId,
      'node',
      'dist/app/cli/main.js',
      ...args,
    ],
    { capture: true },
  )
  return parsePayload(result.stdout)
}

const subscribeOnContainer = (containerId, token, workspaceId) =>
  new Promise((resolvePromise, rejectPromise) => {
    const script = `
const [token, workspaceId] = process.argv.slice(1)
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 15000)
try {
  const response = await fetch(
    'http://127.0.0.1:4317/v1/events/stream?workspace_id=' + encodeURIComponent(workspaceId),
    { headers: { authorization: 'Bearer ' + token }, signal: controller.signal },
  )
  const decoder = new TextDecoder()
  let buffered = ''
  for await (const chunk of response.body) {
    buffered += decoder.decode(chunk, { stream: true })
    const match = buffered.match(/data: (\\{[^\\n]+\\})/)
    if (match) { console.log(match[1]); break }
  }
} finally { clearTimeout(timeout) }
`
    const child = spawn(
      'docker',
      [
        'exec',
        containerId,
        'node',
        '--input-type=module',
        '-e',
        script,
        token,
        workspaceId,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('error', rejectPromise)
    child.on('close', (code) => {
      if (code === 0 && stdout.trim() !== '') {
        resolvePromise(JSON.parse(stdout.trim()))
      } else {
        rejectPromise(
          new Error(`cross-replica subscriber failed (${code}): ${stderr}`),
        )
      }
    })
  })

const waitForExpiredLease = async (token, workspaceId, leaseId) => {
  const deadline = Date.now() + 15_000
  for (;;) {
    const leases = await expectOk(token, 'lease expiry readback', [
      'lease',
      'list',
      '--workspace',
      workspaceId,
    ])
    const lease = leases.find((item) => item.id === leaseId)
    if (lease?.state === 'expired') return lease
    if (Date.now() >= deadline) throw new Error('lease did not expire')
    await delay(250)
  }
}

const expectOk = async (token, label, args) => {
  const result = await cli(token, args)
  if (!result.ok) {
    throw new Error(
      `${label} failed (${String(result.code)}): ${
        result.stderr || JSON.stringify(result.payload)
      }`,
    )
  }
  return result.payload
}

const safeWorkerId = (role) =>
  `agent_ha_${role}_${runId}`.replace(/[^a-zA-Z0-9_]/g, '_')

const initAgent = async (role, permissions, capabilities, kind = 'agent') => {
  const workerId = safeWorkerId(role)
  const session = await expectOk('', `session init (${role})`, [
    'session',
    'init',
    '--worker',
    workerId,
    '--name',
    `HA ${role}`,
    '--kind',
    kind,
    '--vendor',
    'codex',
    '--capabilities',
    capabilities.join(','),
    '--permissions',
    permissions.join(','),
  ])
  return { role, workerId, token: session.session_id }
}

const classifyRace = (agent, result, conflictCode) => {
  if (result.ok) return { agent, kind: 'winner', payload: result.payload }
  if (result.payload?.error?.code === conflictCode) {
    return { agent, kind: 'conflict', payload: result.payload }
  }
  throw new Error(
    `unexpected ${conflictCode} result for ${agent.role}: ${
      result.stderr || JSON.stringify(result.payload)
    }`,
  )
}

const main = async () => {
  try {
    await compose([
      'up',
      '-d',
      ...(skipBuild ? [] : ['--build']),
      '--scale',
      'acp-ha=2',
    ])
    await waitForHealthy('acp-host-ha')
    const replicas = await serviceContainerIds()
    assert(
      replicas.length === 2,
      `expected 2 HA replicas, got ${replicas.length}`,
    )

    const [planner, workerA, workerB, reviewer] = await Promise.all([
      initAgent('planner', plannerPermissions, [
        'supports_checkpoints',
        'supports_leases',
      ]),
      initAgent('worker_a', workerPermissions, [
        'can_edit_files',
        'can_run_commands',
        'supports_leases',
      ]),
      initAgent('worker_b', workerPermissions, [
        'can_edit_files',
        'can_run_commands',
        'supports_leases',
      ]),
      initAgent('reviewer', reviewerPermissions, ['can_review'], 'human'),
    ])

    const workspace = await expectOk(planner.token, 'workspace create', [
      'workspace',
      'create',
      '--name',
      `acp-ha-dogfood-${runId}`,
      '--kind',
      'git_repository',
      '--uri',
      'file:///workspace/acp',
      '--default-branch',
      'main',
    ])
    const work = await expectOk(planner.token, 'work create', [
      'work',
      'create',
      'Docker HA multi-agent dogfood',
      '--workspace',
      workspace.id,
      '--description',
      'Prove the Compose HA profile can coordinate multiple ACP actors through Postgres.',
      '--priority',
      'high',
    ])

    const crossReplicaEvent = subscribeOnContainer(
      replicas[0],
      planner.token,
      workspace.id,
    )
    await delay(750)
    const crossReplicaWork = await cliOnContainer(replicas[1], planner.token, [
      'work',
      'create',
      'Cross-replica pg-notify probe',
      '--workspace',
      workspace.id,
    ])
    const observedCrossReplicaEvent = await crossReplicaEvent
    assert(
      observedCrossReplicaEvent.type === 'work.created' &&
        observedCrossReplicaEvent.work_id === crossReplicaWork.id,
      `cross-replica event mismatch: ${JSON.stringify(observedCrossReplicaEvent)}`,
    )

    const plannerCheckpoint = await expectOk(
      planner.token,
      'planner checkpoint',
      [
        'checkpoint',
        'create',
        '--workspace',
        workspace.id,
        '--work',
        work.id,
        '--summary',
        'Planner opened the HA dogfood work item.',
      ],
    )
    await expectOk(planner.token, 'planner memory', [
      'memory',
      'create',
      '--workspace',
      workspace.id,
      '--work',
      work.id,
      '--kind',
      'decision',
      '--key',
      `docker-ha.${runId}.plan`,
      '--summary',
      'Planner chose a Postgres-backed multi-agent lifecycle.',
      '--content',
      `Plan for HA dogfood run ${runId}.`,
      '--labels',
      'dogfood,docker,ha,multi-agent',
    ])

    const claimResults = await Promise.all([
      cli(workerA.token, [
        'work',
        'claim',
        work.id,
        '--worker',
        workerA.workerId,
      ]).then((result) => classifyRace(workerA, result, 'claim_conflict')),
      cli(workerB.token, [
        'work',
        'claim',
        work.id,
        '--worker',
        workerB.workerId,
      ]).then((result) => classifyRace(workerB, result, 'claim_conflict')),
    ])
    const claimWinner = claimResults.find((result) => result.kind === 'winner')
    const claimConflict = claimResults.find(
      (result) => result.kind === 'conflict',
    )
    assert(claimWinner !== undefined, 'expected a claim winner')
    assert(claimConflict !== undefined, 'expected a claim conflict')
    assert(
      claimResults.filter((result) => result.kind === 'winner').length === 1,
      'expected exactly one claim winner',
    )

    const activeWorker = claimWinner.agent
    const running = await expectOk(activeWorker.token, 'work running', [
      'work',
      'update',
      work.id,
      '--state',
      'running',
    ])
    assert(running.state === 'running', 'work did not enter running')

    const leaseArgs = (holder) => [
      'lease',
      'request',
      '--workspace',
      workspace.id,
      '--holder',
      holder,
      '--kind',
      'worktree',
      '--uri',
      `worktree://docker-ha/${runId}`,
      '--ttl',
      '900',
    ]
    const leaseResults = await Promise.all([
      cli(activeWorker.token, leaseArgs(activeWorker.workerId)).then((result) =>
        classifyRace(activeWorker, result, 'lease_conflict'),
      ),
      cli(
        claimConflict.agent.token,
        leaseArgs(claimConflict.agent.workerId),
      ).then((result) =>
        classifyRace(claimConflict.agent, result, 'lease_conflict'),
      ),
    ])
    const leaseWinner = leaseResults.find((result) => result.kind === 'winner')
    assert(leaseWinner !== undefined, 'expected a lease winner')
    assert(
      leaseResults.filter((result) => result.kind === 'winner').length === 1,
      'expected exactly one lease winner',
    )
    assert(
      leaseResults.some((result) => result.kind === 'conflict'),
      'expected a lease conflict',
    )

    const leaseHolder = leaseWinner.agent
    const lease = leaseWinner.payload
    const renewed = await expectOk(leaseHolder.token, 'lease renew', [
      'lease',
      'renew',
      lease.id,
      '--ttl',
      '900',
    ])
    assert(renewed.state === 'active', 'renewed lease was not active')

    const activeLeases = await expectOk(reviewer.token, 'lease list', [
      'lease',
      'list',
      '--workspace',
      workspace.id,
    ])
    const activeLease = activeLeases.find((item) => item.id === lease.id)
    assert(activeLease?.state === 'active', 'lease was not active on readback')

    const workerCheckpoint = await expectOk(
      activeWorker.token,
      'worker checkpoint',
      [
        'checkpoint',
        'create',
        '--workspace',
        workspace.id,
        '--work',
        work.id,
        '--summary',
        'Worker reached the HA handoff checkpoint.',
      ],
    )
    const handoffMemory = await expectOk(activeWorker.token, 'handoff memory', [
      'memory',
      'create',
      '--workspace',
      workspace.id,
      '--work',
      work.id,
      '--kind',
      'handoff',
      '--key',
      `docker-ha.${runId}.handoff`,
      '--summary',
      'Worker handed off HA context for review.',
      '--content',
      `Handoff for HA dogfood run ${runId}.`,
      '--labels',
      'dogfood,docker,ha,handoff',
    ])
    const artifact = await expectOk(activeWorker.token, 'artifact create', [
      'artifact',
      'create',
      '--workspace',
      workspace.id,
      '--work',
      work.id,
      '--kind',
      'test_report',
      '--uri',
      `acp://dogfood/docker-ha/${runId}/report`,
      '--summary',
      'Docker HA dogfood report.',
    ])

    const firstReview = await expectOk(activeWorker.token, 'review request', [
      'review',
      'request',
      '--work',
      work.id,
      '--by',
      activeWorker.workerId,
      '--reviewer',
      reviewer.workerId,
    ])
    const changes = await expectOk(reviewer.token, 'review request-changes', [
      'review',
      'request-changes',
      firstReview.id,
    ])
    assert(
      changes.state === 'changes_requested',
      'reviewer did not request changes',
    )

    await restartHost('acp-host-ha after review restart')

    const latestCheckpoint = await expectOk(
      reviewer.token,
      'checkpoint latest after restart',
      ['checkpoint', 'latest', '--work', work.id],
    )
    assert(
      latestCheckpoint.id === workerCheckpoint.id,
      'latest checkpoint did not survive restart',
    )
    const handoffRecords = await expectOk(
      reviewer.token,
      'handoff memory after restart',
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
    )
    assert(
      handoffRecords.some((record) => record.id === handoffMemory.id),
      'handoff memory did not survive restart',
    )

    const resumed = await expectOk(activeWorker.token, 'work resume', [
      'work',
      'update',
      work.id,
      '--state',
      'running',
    ])
    assert(resumed.state === 'running', 'work did not resume after changes')

    const secondReview = await expectOk(
      activeWorker.token,
      'second review request',
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
    )
    const approved = await expectOk(reviewer.token, 'review approve', [
      'review',
      'approve',
      secondReview.id,
      '--met',
      'ha_stack,durable_handoff,event_replay',
      '--signature',
      `sig:docker-ha:${runId}`,
      '--signature-algorithm',
      'test-ed25519',
      '--signature-key',
      `dogfood:${reviewer.workerId}`,
    ])
    assert(approved.state === 'approved', 'reviewer did not approve')
    assert(
      approved.approval_signature?.value === `sig:docker-ha:${runId}`,
      'signed approval evidence was not persisted',
    )

    const released = await cli(leaseHolder.token, [
      'lease',
      'release',
      lease.id,
    ])
    assert(released.ok, `lease release failed: ${released.stderr}`)

    const completed = await expectOk(activeWorker.token, 'work complete', [
      'work',
      'update',
      work.id,
      '--state',
      'completed',
    ])
    assert(completed.state === 'completed', 'work did not complete')

    const expiringLease = await expectOk(
      activeWorker.token,
      'expiring lease request',
      [
        'lease',
        'request',
        '--workspace',
        workspace.id,
        '--holder',
        activeWorker.workerId,
        '--kind',
        'file',
        '--uri',
        `file:///tmp/acp-ha-expiry-${runId}`,
        '--ttl',
        '1',
      ],
    )
    await waitForExpiredLease(reviewer.token, workspace.id, expiringLease.id)
    const expiryEvents = await expectOk(reviewer.token, 'lease expiry events', [
      'events',
      'list',
      '--workspace',
      workspace.id,
      '--type',
      'lease.expired',
    ])
    assert(
      expiryEvents.length === 1 &&
        expiryEvents[0].data?.lease_id === expiringLease.id,
      `expected one expiry event, got ${JSON.stringify(expiryEvents)}`,
    )

    await restartHost('acp-host-ha after completion restart')

    const persistedWork = await expectOk(
      reviewer.token,
      'work get after restart',
      ['work', 'get', work.id],
    )
    assert(persistedWork.id === work.id, 'work id did not survive restart')
    assert(
      persistedWork.workspace_id === workspace.id,
      'work workspace binding did not survive restart',
    )
    assert(
      persistedWork.state === 'completed',
      'completed state did not survive restart',
    )

    const events = await expectOk(reviewer.token, 'events list after restart', [
      'events',
      'list',
      '--workspace',
      workspace.id,
      '--after',
      '0',
    ])
    const eventTypes = events.map((event) => event.type)
    for (const eventType of requiredEventTypes) {
      assert(
        eventTypes.includes(eventType),
        `missing durable event ${eventType}: ${JSON.stringify(eventTypes)}`,
      )
    }
    assert(
      events.every(
        (event, index) => index === 0 || event.seq > events[index - 1].seq,
      ),
      'event sequence is not strictly monotonic',
    )

    console.log(
      JSON.stringify(
        {
          ok: true,
          profile: 'ha',
          replicas: replicas.length,
          run_id: runId,
          workspace_id: workspace.id,
          work_id: work.id,
          claim_winner: activeWorker.workerId,
          claim_conflict: claimConflict.agent.workerId,
          lease_winner: leaseHolder.workerId,
          planner_checkpoint_id: plannerCheckpoint.id,
          worker_checkpoint_id: workerCheckpoint.id,
          handoff_memory_id: handoffMemory.id,
          artifact_id: artifact.id,
          first_review_state: changes.state,
          second_review_state: approved.state,
          approval_signature_key: approved.approval_signature?.key_id,
          completed_state: persistedWork.state,
          cross_replica_event_id: observedCrossReplicaEvent.id,
          lease_expiry_event_id: expiryEvents[0].id,
          event_count: events.length,
          event_types: eventTypes,
        },
        null,
        2,
      ),
    )
  } finally {
    if (!keepStack) {
      await compose(['down', '-v'], { capture: false }).catch(() => undefined)
    }
  }
}

await main()
