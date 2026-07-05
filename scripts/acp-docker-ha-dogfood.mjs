#!/usr/bin/env node
/**
 * Docker HA dogfood lane: run the Compose self-host-ha profile, drive the
 * compiled CLI inside the host container, and prove Postgres-backed state
 * survives an ACP host restart.
 */
import { spawn } from 'node:child_process'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

const runId = process.env.ACP_DOGFOOD_RUN_ID ?? Date.now().toString(36)
const keepStack = process.env.ACP_DOCKER_HA_KEEP_STACK === 'true'
const composeArgs = ['compose', '--profile', 'ha']

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
const compose = (args, options) => docker([...composeArgs, ...args], options)

const healthStatus = async () => {
  const { stdout } = await docker(
    ['inspect', '-f', '{{.State.Health.Status}}', 'acp-host-ha'],
    { capture: true },
  ).catch(() => ({ stdout: 'none' }))
  return stdout.trim()
}

const waitForHealthy = async (label) => {
  const deadline = Date.now() + 180_000
  for (;;) {
    if ((await healthStatus()) === 'healthy') return
    if (Date.now() > deadline) {
      await compose(['logs'], { capture: false }).catch(() => undefined)
      throw new Error(`${label} did not become healthy`)
    }
    await delay(3_000)
  }
}

const cli = async (args) => {
  const { stdout } = await run('./bin/acp', args, {
    capture: true,
    env: { ACP_COMPOSE_SERVICE: 'acp-ha' },
  })
  return JSON.parse(stdout)
}

const assert = (condition, message) => {
  if (!condition) throw new Error(`assertion failed: ${message}`)
}

const main = async () => {
  try {
    await compose(['up', '-d', '--build'])
    await waitForHealthy('acp-host-ha')

    const workspace = await cli([
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
    const work = await cli([
      'work',
      'create',
      'Docker HA durability dogfood',
      '--workspace',
      workspace.id,
      '--description',
      'Prove the Compose HA profile stores ACP coordination state in Postgres.',
      '--priority',
      'high',
    ])

    await cli(['work', 'claim', work.id, '--worker', `agent_ha_${runId}`])
    await cli(['work', 'update', work.id, '--state', 'running'])
    const checkpoint = await cli([
      'checkpoint',
      'create',
      '--workspace',
      workspace.id,
      '--work',
      work.id,
      '--summary',
      'HA dogfood reached durable checkpoint before restart.',
    ])
    const memory = await cli([
      'memory',
      'create',
      '--workspace',
      workspace.id,
      '--work',
      work.id,
      '--kind',
      'observation',
      '--key',
      `dogfood.docker-ha.${runId}`,
      '--summary',
      'Postgres HA profile accepted coordination state before restart.',
      '--content',
      'The ACP host is running in the Compose self-host-ha profile with Postgres storage and pg-notify configured.',
      '--labels',
      'dogfood,docker,ha,postgres',
    ])

    await compose(['restart', 'acp-ha'])
    await waitForHealthy('acp-host-ha after restart')

    const persistedWork = await cli(['work', 'get', work.id])
    const events = await cli(['events', 'list', '--workspace', workspace.id])
    const eventTypes = events.map((event) => event.type)

    assert(persistedWork.id === work.id, 'work id survived restart')
    assert(
      persistedWork.workspace_id === workspace.id,
      'work remained bound to original workspace',
    )
    assert(
      eventTypes.includes('workspace.created') &&
        eventTypes.includes('work.created') &&
        eventTypes.includes('checkpoint.created') &&
        eventTypes.includes('memory.created'),
      `missing expected durable events: ${JSON.stringify(eventTypes)}`,
    )

    console.log(
      JSON.stringify(
        {
          ok: true,
          profile: 'ha',
          workspace_id: workspace.id,
          work_id: work.id,
          checkpoint_id: checkpoint.id,
          memory_id: memory.id,
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
