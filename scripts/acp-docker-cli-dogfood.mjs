#!/usr/bin/env node
/**
 * Docker-hosted dogfood lane: build the production image, run the host, then
 * drive the compiled CLI inside that same container against localhost:4317.
 */
import { spawn } from 'node:child_process'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

const image = process.env.ACP_DOCKER_IMAGE ?? 'acp:docker-cli-dogfood'
const container =
  process.env.ACP_DOCKER_CONTAINER ?? `acp-docker-cli-dogfood-${Date.now()}`
const runId = process.env.ACP_DOGFOOD_RUN_ID ?? Date.now().toString(36)
const baseUrl = 'http://127.0.0.1:4317'

const expectedEventTypes = [
  'workspace.created',
  'work.created',
  'work.created',
  'work.claimed',
  'work.started',
  'checkpoint.created',
  'memory.created',
  'artifact.created',
  'review.requested',
  'work.needs_review',
  'review.approved',
  'work.completed',
]

const assert = (condition, message) => {
  if (!condition) throw new Error(`assertion failed: ${message}`)
}

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
      if (code === 0) {
        resolvePromise({ stdout, stderr })
        return
      }
      rejectPromise(
        new Error(
          `${command} ${args.join(' ')} exited ${code}: ${stderr || stdout}`,
        ),
      )
    })
  })

const docker = (args, options) => run('docker', args, options)

const dockerCapture = async (args) =>
  (await docker(args, { capture: true })).stdout.trim()

const waitForReady = async () => {
  const deadline = Date.now() + 20_000
  for (;;) {
    try {
      const out = await dockerCapture([
        'exec',
        container,
        'node',
        '-e',
        "fetch('http://127.0.0.1:4317/ready').then(async r=>{process.stdout.write(await r.text()); process.exit(r.ok?0:1)}).catch(()=>process.exit(1))",
      ])
      if (out.includes('"ready"')) return
    } catch {
      // Host is still booting.
    }
    if (Date.now() > deadline)
      throw new Error('ACP container did not become ready')
    await delay(250)
  }
}

const cli = async (token, args) => {
  const dockerArgs = [
    'exec',
    '-e',
    `ACP_BASE_URL=${baseUrl}`,
    ...(token === '' ? [] : ['-e', `ACP_RPC_TOKEN=${token}`]),
    container,
    'node',
    'dist/app/cli/main.js',
    ...args,
  ]
  const { stdout } = await docker(dockerArgs, { capture: true })
  return JSON.parse(stdout)
}

const initAgent = async (role, permissions, capabilities, kind = 'agent') => {
  const worker = `${kind}_${role}_${runId}`.replace(/[^a-zA-Z0-9_]/g, '_')
  const session = await cli('', [
    'session',
    'init',
    '--worker',
    worker,
    '--name',
    `Docker ${role}`,
    '--kind',
    kind,
    '--capabilities',
    capabilities.join(','),
    '--permissions',
    permissions.join(','),
  ])
  return { worker, token: session.session_id }
}

const main = async () => {
  await docker(['build', '-t', image, '.'])
  await docker(['run', '--rm', '-d', '--name', container, image], {
    capture: true,
  })

  try {
    await waitForReady()

    const planner = await initAgent(
      'planner',
      [
        'workspace:read',
        'workspace:write',
        'work:create',
        'checkpoint:create',
        'memory:create',
        'review:create',
        'event:read',
      ],
      ['can_edit_files', 'supports_checkpoints'],
    )
    const worker = await initAgent(
      'worker',
      [
        'work:claim',
        'work:update',
        'checkpoint:create',
        'memory:create',
        'artifact:create',
        'event:read',
      ],
      ['can_edit_files', 'can_run_commands', 'supports_checkpoints'],
    )
    const reviewer = await initAgent(
      'reviewer',
      ['review:approve', 'event:read'],
      ['can_review'],
      'human',
    )

    const workspace = await cli(planner.token, [
      'workspace',
      'create',
      '--name',
      `acp-docker-cli-dogfood-${runId}`,
      '--kind',
      'git_repository',
      '--uri',
      'file:///workspace/acp',
      '--default-branch',
      'main',
    ])
    const work = await cli(planner.token, [
      'work',
      'create',
      'Docker-hosted ACP CLI dogfood',
      '--workspace',
      workspace.id,
      '--description',
      'Build the image, run the host, and coordinate through the compiled CLI inside Docker.',
      '--priority',
      'high',
    ])
    const backlogWork = await cli(planner.token, [
      'work',
      'create',
      'Docker-hosted ACP CLI backlog item',
      '--workspace',
      workspace.id,
      '--description',
      'Normal priority item used to prove work list priority filtering.',
      '--priority',
      'normal',
    ])

    const highPriorityOpen = await cli(planner.token, [
      'work',
      'list',
      '--workspace',
      workspace.id,
      '--state',
      'open',
      '--priority',
      'high',
    ])
    assert(
      highPriorityOpen.length === 1 && highPriorityOpen[0].id === work.id,
      `expected only high/open work, got ${JSON.stringify(highPriorityOpen)}`,
    )
    assert(
      backlogWork.priority === 'normal',
      `expected normal backlog priority, got ${JSON.stringify(backlogWork)}`,
    )

    await cli(worker.token, [
      'work',
      'claim',
      work.id,
      '--worker',
      worker.worker,
    ])
    const assignedToWorker = await cli(planner.token, [
      'work',
      'list',
      '--workspace',
      workspace.id,
      '--assigned-to',
      worker.worker,
    ])
    assert(
      assignedToWorker.length === 1 && assignedToWorker[0].id === work.id,
      `expected only work assigned to worker, got ${JSON.stringify(
        assignedToWorker,
      )}`,
    )
    await cli(worker.token, ['work', 'update', work.id, '--state', 'running'])
    const highPriorityRunning = await cli(planner.token, [
      'work',
      'list',
      '--workspace',
      workspace.id,
      '--state',
      'running',
      '--priority',
      'high',
    ])
    assert(
      highPriorityRunning.length === 1 && highPriorityRunning[0].id === work.id,
      `expected only high/running work, got ${JSON.stringify(
        highPriorityRunning,
      )}`,
    )
    await cli(worker.token, [
      'checkpoint',
      'create',
      '--workspace',
      workspace.id,
      '--work',
      work.id,
      '--summary',
      'Docker-hosted CLI dogfood reached checkpoint.',
    ])
    await cli(worker.token, [
      'memory',
      'create',
      '--workspace',
      workspace.id,
      '--work',
      work.id,
      '--kind',
      'decision',
      '--key',
      `dogfood.docker-cli.${runId}`,
      '--summary',
      'Production image can coordinate through its compiled CLI.',
      '--content',
      'The same container ran the ACP host and CLI over localhost.',
      '--labels',
      'dogfood,docker,cli',
    ])
    await cli(worker.token, [
      'artifact',
      'create',
      '--workspace',
      workspace.id,
      '--work',
      work.id,
      '--kind',
      'markdown',
      '--summary',
      'Docker CLI dogfood report',
      '--content',
      `workspace=${workspace.id} work=${work.id}`,
    ])

    const review = await cli(planner.token, [
      'review',
      'request',
      '--work',
      work.id,
      '--by',
      planner.worker,
      '--reviewer',
      reviewer.worker,
    ])
    await cli(reviewer.token, [
      'review',
      'approve',
      review.id,
      '--met',
      'docker_build,docker_ready,built_cli_flow',
    ])
    await cli(worker.token, ['work', 'update', work.id, '--state', 'completed'])

    const events = await cli(planner.token, [
      'events',
      'list',
      '--workspace',
      workspace.id,
    ])
    const eventTypes = events.map((event) => event.type)
    assert(
      JSON.stringify(eventTypes) === JSON.stringify(expectedEventTypes),
      `unexpected event sequence: ${JSON.stringify(eventTypes)}`,
    )

    console.log(
      JSON.stringify(
        {
          ok: true,
          image,
          container,
          workspace_id: workspace.id,
          work_id: work.id,
          review_id: review.id,
          event_count: events.length,
          event_types: eventTypes,
        },
        null,
        2,
      ),
    )
  } finally {
    await docker(['stop', container], { capture: true }).catch(() => undefined)
  }
}

await main()
