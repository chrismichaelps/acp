#!/usr/bin/env node

import {
  assert,
  expectPayload as expectPayloadFor,
  optionValue,
  request as requestFor,
  requestAny as requestAnyFor,
} from './acp-dogfood-http.mjs'

const baseUrl = (process.env.ACP_BASE_URL ?? 'http://localhost:4317').replace(
  /\/$/,
  '',
)
const runId = process.env.ACP_DOGFOOD_RUN_ID ?? Date.now().toString(36)

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
  'work:publish_event',
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

const request = (...args) => requestFor(baseUrl, ...args)
const requestAny = (...args) => requestAnyFor(baseUrl, ...args)
const expectPayload = (...args) => expectPayloadFor(baseUrl, ...args)

const initAgent = async (role, permissions, capabilities) => {
  const workerId = `agent_codex_${role}_${runId}`.replace(/[^a-zA-Z0-9_]/g, '_')
  const session = await expectPayload('POST', '/v1/session/initialize', {
    worker: {
      id: workerId,
      name: `Codex ${role}`,
      kind: 'agent',
      vendor: 'openai',
      capabilities,
    },
    permissions,
  })

  return { role, workerId, token: session.session_id }
}

const createCheckpoint = (agent, workspaceId, workId, summary, steps) =>
  expectPayload(
    'POST',
    '/v1/checkpoints',
    {
      workspace_id: workspaceId,
      work_id: workId,
      summary,
      completed_steps: steps,
      remaining_steps: ['continue from ACP event replay'],
      modified_resources: [`worktree://multi-agent-dogfood/${runId}`],
    },
    agent.token,
    [201],
  )

const createMemory = (agent, workspaceId, workId, kind, key, summary) =>
  expectPayload(
    'POST',
    '/v1/memory',
    {
      workspace_id: workspaceId,
      work_id: workId,
      kind,
      key,
      summary,
      content: `${summary} Run ${runId}; actor ${agent.workerId}.`,
      labels: ['dogfood', 'codex', 'multi-agent', kind],
    },
    agent.token,
    [201],
  )

const classifyClaim = (agent, result) => {
  if (result.status === 200) {
    return { agent, kind: 'winner', work: result.payload }
  }
  if (
    result.status === 409 &&
    result.payload?.error?.code === 'claim_conflict'
  ) {
    return { agent, kind: 'conflict', error: result.payload.error }
  }
  throw new Error(
    `unexpected claim response for ${agent.role}: ${result.status} ${result.text}`,
  )
}

const classifyLease = (agent, result) => {
  if (result.status === 201) {
    return { agent, kind: 'winner', lease: result.payload }
  }
  if (
    result.status === 409 &&
    result.payload?.error?.code === 'lease_conflict'
  ) {
    return { agent, kind: 'conflict', error: result.payload.error }
  }
  throw new Error(
    `unexpected lease response for ${agent.role}: ${result.status} ${result.text}`,
  )
}

const eventTypes = (events) => events.map((event) => event.type)
const isMonotonic = (events) =>
  events.every(
    (event, index) => index === 0 || event.seq > events[index - 1].seq,
  )

const main = async () => {
  const [planner, workerA, workerB, reviewer] = await Promise.all([
    initAgent('planner', plannerPermissions, [
      'supports_checkpoints',
      'supports_leases',
    ]),
    initAgent('worker_a', workerPermissions, [
      'can_edit_files',
      'can_run_commands',
      'can_create_prs',
      'supports_checkpoints',
      'supports_leases',
    ]),
    initAgent('worker_b', workerPermissions, [
      'can_edit_files',
      'can_run_commands',
      'can_create_prs',
      'supports_checkpoints',
      'supports_leases',
    ]),
    initAgent('reviewer', reviewerPermissions, ['can_review']),
  ])

  const workspace = await expectPayload(
    'POST',
    '/v1/workspaces',
    {
      name: `acp/multi-agent-dogfood-${runId}`,
      kind: 'git_repository',
      uri: 'git+https://github.com/chrismichaelps/acp.git',
      default_branch: 'main',
    },
    planner.token,
    [201],
  )
  const work = await expectPayload(
    'POST',
    '/v1/work',
    {
      workspace_id: workspace.id,
      title: `Multi-agent ACP dogfood ${runId}`,
      description:
        'Exercise ACP with separate Codex-shaped agents racing for work, leases, handoff, review, and completion.',
      priority: 'high',
    },
    planner.token,
    [201],
  )

  const plannerCheckpoint = await createCheckpoint(
    planner,
    workspace.id,
    work.id,
    'Planner created the shared ACP work item.',
    ['created workspace', 'created work item'],
  )
  await createMemory(
    planner,
    workspace.id,
    work.id,
    'decision',
    `multi-agent.${runId}.plan`,
    'Planner selected a shared worktree lease race.',
  )

  const claimResults = await Promise.all([
    requestAny(
      'POST',
      `/v1/work/${encodeURIComponent(work.id)}/claim`,
      { worker_id: workerA.workerId },
      workerA.token,
    ).then((result) => classifyClaim(workerA, result)),
    requestAny(
      'POST',
      `/v1/work/${encodeURIComponent(work.id)}/claim`,
      { worker_id: workerB.workerId },
      workerB.token,
    ).then((result) => classifyClaim(workerB, result)),
  ])
  const claimWinners = claimResults.filter((result) => result.kind === 'winner')
  const claimConflicts = claimResults.filter(
    (result) => result.kind === 'conflict',
  )
  assert(claimWinners.length === 1, 'expected exactly one work claim winner')
  assert(
    claimConflicts.length === 1,
    'expected exactly one work claim conflict',
  )

  const activeWorker = claimWinners[0].agent
  const standbyWorker = claimConflicts[0].agent
  const running = await expectPayload(
    'PATCH',
    `/v1/work/${encodeURIComponent(work.id)}`,
    { state: 'running' },
    activeWorker.token,
  )
  assert(
    running.state === 'running',
    'claimed work did not enter running state',
  )

  const resource = {
    kind: 'worktree',
    uri: `worktree://multi-agent-dogfood/${runId}`,
  }
  const leaseResults = await Promise.all([
    requestAny(
      'POST',
      '/v1/leases',
      {
        workspace_id: workspace.id,
        work_id: work.id,
        holder: activeWorker.workerId,
        resource,
        ttl_seconds: 900,
      },
      activeWorker.token,
    ).then((result) => classifyLease(activeWorker, result)),
    requestAny(
      'POST',
      '/v1/leases',
      {
        workspace_id: workspace.id,
        work_id: work.id,
        holder: standbyWorker.workerId,
        resource,
        ttl_seconds: 900,
      },
      standbyWorker.token,
    ).then((result) => classifyLease(standbyWorker, result)),
  ])
  const leaseWinners = leaseResults.filter((result) => result.kind === 'winner')
  const leaseConflicts = leaseResults.filter(
    (result) => result.kind === 'conflict',
  )
  assert(leaseWinners.length === 1, 'expected exactly one lease winner')
  assert(leaseConflicts.length === 1, 'expected exactly one lease conflict')

  const leaseHolder = leaseWinners[0].agent
  const lease = leaseWinners[0].lease
  const renewed = await expectPayload(
    'POST',
    `/v1/leases/${encodeURIComponent(lease.id)}/renew`,
    { ttl_seconds: 900 },
    leaseHolder.token,
  )
  assert(renewed.state === 'active', 'renewed lease was not active')
  const activeLeases = await expectPayload(
    'GET',
    `/v1/leases?workspace_id=${encodeURIComponent(workspace.id)}`,
    undefined,
    reviewer.token,
  )
  const activeLease = activeLeases.find(
    (candidate) => candidate.id === lease.id,
  )
  assert(activeLease?.state === 'active', 'lease readback did not show active')

  const workerCheckpoint = await createCheckpoint(
    activeWorker,
    workspace.id,
    work.id,
    'Winning worker implemented the coordinated task.',
    ['won claim race', 'observed lease contention', 'published handoff'],
  )
  const handoffMemory = await createMemory(
    activeWorker,
    workspace.id,
    work.id,
    'handoff',
    `multi-agent.${runId}.handoff`,
    'Winning worker handed off implementation context for review.',
  )
  const artifact = await expectPayload(
    'POST',
    '/v1/artifacts',
    {
      workspace_id: workspace.id,
      work_id: work.id,
      kind: 'test_report',
      uri: `acp://dogfood/multi-agent/${runId}/report`,
      summary: 'Multi-agent dogfood coordination report.',
    },
    activeWorker.token,
    [201],
  )
  await expectPayload(
    'POST',
    `/v1/work/${encodeURIComponent(work.id)}/events`,
    {
      type: 'work.progressed',
      data: {
        run_id: runId,
        planner_checkpoint_id: plannerCheckpoint.id,
        worker_checkpoint_id: workerCheckpoint.id,
        handoff_memory_id: handoffMemory.id,
        artifact_id: artifact.id,
      },
    },
    activeWorker.token,
    [201],
  )

  const latestCheckpoint = await expectPayload(
    'GET',
    `/v1/work/${encodeURIComponent(work.id)}/checkpoints/latest`,
    undefined,
    reviewer.token,
  )
  const handoffRecords = await expectPayload(
    'GET',
    `/v1/memory?workspace_id=${encodeURIComponent(
      workspace.id,
    )}&work_id=${encodeURIComponent(work.id)}&kind=handoff`,
    undefined,
    reviewer.token,
  )
  assert(
    latestCheckpoint.id === workerCheckpoint.id,
    'reviewer did not read the latest worker checkpoint',
  )
  assert(handoffRecords.length === 1, 'reviewer did not read handoff memory')

  const firstReview = await expectPayload(
    'POST',
    '/v1/reviews',
    {
      work_id: work.id,
      requested_by: activeWorker.workerId,
      reviewer: reviewer.workerId,
      requirements: ['tests_pass'],
    },
    activeWorker.token,
    [201],
  )
  const changes = await expectPayload(
    'POST',
    `/v1/reviews/${encodeURIComponent(firstReview.id)}/request_changes`,
    undefined,
    reviewer.token,
  )
  assert(
    changes.state === 'changes_requested',
    'reviewer did not request changes',
  )

  const resumed = await expectPayload(
    'PATCH',
    `/v1/work/${encodeURIComponent(work.id)}`,
    { state: 'running' },
    activeWorker.token,
  )
  assert(resumed.state === 'running', 'work did not resume after changes')
  const secondReview = await expectPayload(
    'POST',
    '/v1/reviews',
    {
      work_id: work.id,
      requested_by: activeWorker.workerId,
      reviewer: reviewer.workerId,
      requirements: ['tests_pass'],
    },
    activeWorker.token,
    [201],
  )
  const approved = await expectPayload(
    'POST',
    `/v1/reviews/${encodeURIComponent(secondReview.id)}/approve`,
    { met_requirements: ['tests_pass'] },
    reviewer.token,
  )
  assert(approved.state === 'approved', 'reviewer did not approve review')

  const released = await request(
    'POST',
    `/v1/leases/${encodeURIComponent(lease.id)}/release`,
    undefined,
    leaseHolder.token,
    [204],
  )
  assert(released.status === 204, 'lease release did not return 204')
  const releasedLeases = await expectPayload(
    'GET',
    `/v1/leases?workspace_id=${encodeURIComponent(workspace.id)}`,
    undefined,
    reviewer.token,
  )
  const releasedLease = releasedLeases.find(
    (candidate) => candidate.id === lease.id,
  )
  assert(
    releasedLease?.state === 'released',
    'lease readback did not show released',
  )

  const completed = await expectPayload(
    'PATCH',
    `/v1/work/${encodeURIComponent(work.id)}`,
    { state: 'completed' },
    activeWorker.token,
  )
  assert(completed.state === 'completed', 'work did not complete')

  const events = await expectPayload(
    'GET',
    `/v1/events?workspace_id=${encodeURIComponent(workspace.id)}&after_seq=0`,
    undefined,
    reviewer.token,
  )
  const types = eventTypes(events)
  for (const required of [
    'work.created',
    'checkpoint.created',
    'memory.created',
    'work.claimed',
    'work.started',
    'lease.granted',
    'lease.renewed',
    'work.progressed',
    'review.requested',
    'review.changes_requested',
    'work.unblocked',
    'review.approved',
    'lease.released',
    'work.completed',
  ]) {
    assert(types.includes(required), `missing replayed event ${required}`)
  }
  assert(isMonotonic(events), 'event sequence is not strictly monotonic')

  console.log(
    JSON.stringify(
      {
        ok: true,
        base_url: baseUrl,
        run_id: runId,
        workspace_id: workspace.id,
        work_id: work.id,
        claim_winner: activeWorker.workerId,
        claim_conflict: standbyWorker.workerId,
        lease_winner: leaseHolder.workerId,
        lease_conflict_holder: optionValue(leaseConflicts[0].error.details)
          ?.holder,
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
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
