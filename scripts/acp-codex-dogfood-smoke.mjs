#!/usr/bin/env node

const baseUrl = (process.env.ACP_BASE_URL ?? 'http://localhost:4317').replace(
  /\/$/,
  '',
)
const runId = process.env.ACP_DOGFOOD_RUN_ID ?? Date.now().toString(36)
const workerId = process.env.ACP_DOGFOOD_WORKER_ID ?? 'agent_codex_dogfood'
const workspaceId = process.env.ACP_DOGFOOD_WORKSPACE_ID?.trim() || undefined

const permissions = [
  'workspace:read',
  'workspace:write',
  'work:create',
  'work:claim',
  'work:update',
  'work:publish_event',
  'lease:create',
  'lease:renew',
  'lease:release',
  'artifact:create',
  'checkpoint:create',
  'memory:create',
  'memory:read',
  'review:create',
  'review:approve',
  'event:read',
]

const request = async (method, path, body, token, expected = [200]) => {
  const headers = {}
  if (body !== undefined) {
    headers['content-type'] = 'application/json'
  }
  if (token !== undefined) {
    headers.authorization = `Bearer ${token}`
  }

  const response = await globalThis.fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  const payload = text === '' ? undefined : JSON.parse(text)

  if (!expected.includes(response.status)) {
    throw new Error(
      `${method} ${path} returned ${response.status}: ${text.slice(0, 500)}`,
    )
  }

  return payload
}

const main = async () => {
  const session = await request('POST', '/v1/session/initialize', {
    worker: {
      id: workerId,
      name: 'Codex Dogfood',
      kind: 'agent',
      vendor: 'openai',
      capabilities: [
        'can_edit_files',
        'can_run_commands',
        'can_create_prs',
        'can_review',
        'supports_checkpoints',
        'supports_leases',
      ],
    },
    permissions,
    ...(workspaceId === undefined ? {} : { workspace_ids: [workspaceId] }),
  })
  const token = session.session_id

  const workspace =
    workspaceId === undefined
      ? await request(
          'POST',
          '/v1/workspaces',
          {
            name: `acp/codex-dogfood-${runId}`,
            kind: 'git_repository',
            uri: 'git+https://github.com/chrismichaelps/acp.git',
            default_branch: 'main',
          },
          token,
          [201],
        )
      : { id: workspaceId }

  const work = await request(
    'POST',
    '/v1/work',
    {
      workspace_id: workspace.id,
      title: `Codex dogfood production smoke ${runId}`,
      description:
        'Exercise ACP as a real Codex worker: session, work, lease, checkpoint, memory, artifact, review, events.',
      priority: 'normal',
    },
    token,
    [201],
  )

  const claimed = await request(
    'POST',
    `/v1/work/${encodeURIComponent(work.id)}/claim`,
    { worker_id: workerId },
    token,
  )
  const running = await request(
    'PATCH',
    `/v1/work/${encodeURIComponent(work.id)}`,
    { state: 'running' },
    token,
  )

  const lease = await request(
    'POST',
    '/v1/leases',
    {
      workspace_id: workspace.id,
      work_id: work.id,
      holder: workerId,
      resource: {
        kind: 'worktree',
        uri: `worktree://codex-dogfood/${runId}`,
      },
      ttl_seconds: 900,
    },
    token,
    [201],
  )
  const renewed = await request(
    'POST',
    `/v1/leases/${encodeURIComponent(lease.id)}/renew`,
    { ttl_seconds: 900 },
    token,
  )

  const checkpoint = await request(
    'POST',
    '/v1/checkpoints',
    {
      workspace_id: workspace.id,
      work_id: work.id,
      summary: 'Codex dogfood smoke reached checkpoint.',
      completed_steps: ['initialized session', 'claimed work', 'held lease'],
      remaining_steps: ['inspect event replay', 'release lease'],
      modified_resources: [`worktree://codex-dogfood/${runId}`],
    },
    token,
    [201],
  )

  const memory = await request(
    'POST',
    '/v1/memory',
    {
      workspace_id: workspace.id,
      work_id: work.id,
      kind: 'observation',
      key: `dogfood.codex.${runId}`,
      summary: 'Codex dogfood smoke exercised ACP coordination primitives.',
      content:
        'This record was created by the Codex dogfood runner to test ACP as production coordination state.',
      labels: ['dogfood', 'codex', 'production-smoke'],
    },
    token,
    [201],
  )

  const artifact = await request(
    'POST',
    '/v1/artifacts',
    {
      workspace_id: workspace.id,
      work_id: work.id,
      kind: 'pull_request',
      uri:
        process.env.ACP_DOGFOOD_PR_URL ??
        `https://github.com/chrismichaelps/acp/pull/dogfood-${runId}`,
      summary: 'Dogfood PR artifact placeholder for Codex ACP testing.',
    },
    token,
    [201],
  )

  const progress = await request(
    'POST',
    `/v1/work/${encodeURIComponent(work.id)}/events`,
    {
      type: 'work.progressed',
      data: {
        run_id: runId,
        checkpoint_id: checkpoint.id,
        memory_id: memory.id,
        artifact_id: artifact.id,
      },
    },
    token,
    [201],
  )

  const review = await request(
    'POST',
    '/v1/reviews',
    {
      work_id: work.id,
      requested_by: workerId,
      requirements: [],
    },
    token,
    [201],
  )
  const approvedReview = await request(
    'POST',
    `/v1/reviews/${encodeURIComponent(review.id)}/approve`,
    { met_requirements: [] },
    token,
  )

  await request(
    'POST',
    `/v1/leases/${encodeURIComponent(lease.id)}/release`,
    undefined,
    token,
    [204],
  )
  const completed = await request(
    'PATCH',
    `/v1/work/${encodeURIComponent(work.id)}`,
    { state: 'completed' },
    token,
  )
  const events = await request(
    'GET',
    `/v1/events?workspace_id=${encodeURIComponent(workspace.id)}&after_seq=0`,
    undefined,
    token,
  )

  console.log(
    JSON.stringify(
      {
        ok: true,
        base_url: baseUrl,
        run_id: runId,
        worker_id: workerId,
        workspace_id: workspace.id,
        work_id: work.id,
        claimed_state: claimed.state,
        running_state: running.state,
        completed_state: completed.state,
        lease_id: lease.id,
        lease_state_after_renew: renewed.state,
        checkpoint_id: checkpoint.id,
        memory_id: memory.id,
        artifact_id: artifact.id,
        review_id: review.id,
        progress_event_id: progress.id,
        review_state_after_approval: approvedReview.state,
        replayed_events: events.length,
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
