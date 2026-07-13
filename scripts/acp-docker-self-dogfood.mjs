#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import {
  assert,
  containerFetch,
  docker,
  dockerOk,
  makeCli,
  waitForReady,
} from './acp-docker-self-support.mjs'
import { runFeatureScenario } from './acp-docker-self-scenario.mjs'
import {
  proveAuth,
  proveRestartPersistence,
} from './acp-docker-self-state-probes.mjs'
import { proveTransports } from './acp-docker-self-transport-probes.mjs'

const image = process.env.ACP_DOCKER_IMAGE ?? 'acp:docker-self-dogfood'
const runId = process.env.ACP_DOGFOOD_RUN_ID ?? Date.now().toString(36)
const container = `acp-docker-self-${runId}`
const authContainer = `${container}-auth`
const volume = `${container}-data`

const cleanup = async () => {
  await docker(['rm', '-f', container]).catch(() => undefined)
  await docker(['rm', '-f', authContainer]).catch(() => undefined)
  await docker(['volume', 'rm', volume]).catch(() => undefined)
}

const runVisible = (command, args, env = {}) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: 'inherit',
    })
    child.on('error', rejectPromise)
    child.on('close', (code) => {
      if (code === 0) resolvePromise()
      else
        rejectPromise(new Error(`${command} ${args.join(' ')} exited ${code}`))
    })
  })

export const runRepositoryPreflights = async (runner = runVisible) => {
  await runner('node', ['scripts/check-edge-runtime-pins.mjs'])
  await runner('node', ['scripts/check-agent-doc-permissions.mjs'])
}

export const verifyComposeProjectIsolation = (first, second) => {
  assert(first.name !== second.name, 'Compose project identities must differ')
  for (const config of [first, second]) {
    assert(
      typeof config.name === 'string' && config.name.length > 0,
      'Compose config must expose its project identity',
    )
    for (const [serviceName, service] of Object.entries(
      config.services ?? {},
    )) {
      assert(
        service.container_name === undefined,
        `Compose service ${serviceName} must not fix container_name`,
      )
    }
  }
}

export const verifyGeneratedContainerNames = (first, second) => {
  assert(first.length > 0, 'first Compose project created no containers')
  assert(second.length > 0, 'second Compose project created no containers')
  const overlap = first.filter((name) => second.includes(name))
  assert(
    overlap.length === 0,
    `Compose projects generated overlapping container names: ${overlap.join(', ')}`,
  )
}

const parseComposePsNames = (output) => {
  const parsed = JSON.parse(output)
  const entries = Array.isArray(parsed) ? parsed : [parsed]
  return entries
    .map((entry) => entry.Name)
    .filter((name) => typeof name === 'string' && name.length > 0)
}

export const proveComposeProjectIsolation = async ({
  run = dockerOk,
  projectNames = ['acp-isolation-a', 'acp-isolation-b'],
} = {}) => {
  const renderProject = async (project) =>
    JSON.parse(
      await run([
        'compose',
        '--project-name',
        project,
        '--profile',
        'sqlite',
        '--profile',
        'ha',
        '--profile',
        'edge',
        'config',
        '--format',
        'json',
      ]),
    )
  const [first, second] = await Promise.all([
    renderProject(projectNames[0]),
    renderProject(projectNames[1]),
  ])
  verifyComposeProjectIsolation(first, second)

  const compose = (project, args) => [
    'compose',
    '--project-name',
    project,
    '--profile',
    'sqlite',
    ...args,
  ]
  let operationError
  let operationFailed = false
  let generatedNames
  let cleanupResults
  try {
    const createResults = await Promise.allSettled(
      projectNames.map((project) =>
        run(compose(project, ['create', '--no-build', 'acp'])),
      ),
    )
    const createFailure = createResults.find(
      (result) => result.status === 'rejected',
    )
    if (createFailure?.status === 'rejected') throw createFailure.reason
    generatedNames = await Promise.all(
      projectNames.map(async (project) =>
        parseComposePsNames(
          await run(compose(project, ['ps', '-a', '--format', 'json'])),
        ),
      ),
    )
    verifyGeneratedContainerNames(generatedNames[0], generatedNames[1])
  } catch (error) {
    operationError = error
    operationFailed = true
  } finally {
    cleanupResults = await Promise.allSettled(
      projectNames.map((project) =>
        run(compose(project, ['down', '--volumes', '--remove-orphans'])),
      ),
    )
  }

  if (operationFailed) throw operationError
  const cleanupFailure = cleanupResults.find(
    (result) => result.status === 'rejected',
  )
  if (cleanupFailure?.status === 'rejected') throw cleanupFailure.reason
  return generatedNames
}

const runDockerSelfScenario = async () => {
  await cleanup()
  await runVisible('docker', ['build', '-t', image, '.'])
  await dockerOk(['tag', image, 'acp:latest'])
  await proveComposeProjectIsolation({
    projectNames: [`acp-isolation-${runId}-a`, `acp-isolation-${runId}-b`],
  })
  await dockerOk(['volume', 'create', volume])
  await dockerOk([
    'run',
    '-d',
    '--name',
    container,
    '-e',
    'ACP_STORAGE_ADAPTER=sqlite',
    '-e',
    'ACP_SQLITE_PATH=/data/acp.sqlite',
    '-v',
    `${volume}:/data`,
    image,
  ])

  try {
    await waitForReady(container)
    const health = await containerFetch(container, '/health')
    const ready = await containerFetch(container, '/ready')
    assert(
      health.status === 200 && ready.status === 200,
      'health contract failed',
    )

    const cli = makeCli(container)
    const scenario = await runFeatureScenario(cli, runId)
    const streamChild = await proveTransports({
      container,
      scenario,
      cli,
      runId,
    })
    await proveRestartPersistence({ container, scenario, cli, streamChild })
    await proveAuth({ image, authContainer, runId })

    await dockerOk(['rm', '-f', container])
    await dockerOk(['rm', '-f', authContainer])
    await dockerOk(['volume', 'rm', volume])

    const reuseImage = { ACP_DOCKER_SKIP_BUILD: 'true' }
    await runVisible('node', ['scripts/acp-docker-ha-dogfood.mjs'], reuseImage)
    await runVisible('node', ['scripts/acp-docker-edge-smoke.mjs'], reuseImage)

    console.log(
      JSON.stringify(
        {
          ok: true,
          run_id: runId,
          image,
          sqlite: {
            workspace_id: scenario.workspace.id,
            work_id: scenario.work.id,
            review_id: scenario.review.id,
            command_families: 13,
            persistence_restart: true,
          },
          transports: [
            'rest-cli',
            'sse',
            'json-rpc-http',
            'json-rpc-stdio',
            'json-rpc-websocket',
            'native-effect-rpc',
          ],
          auth: ['required-bearer', 'permission-denial', 'workspace-binding'],
          ha: true,
          edge: true,
          external_gaps: [
            'gh import/sync/merge require an authenticated external repository and merge authority',
          ],
        },
        null,
        2,
      ),
    )
  } finally {
    await cleanup()
  }
}

export const main = async ({
  preflight = runRepositoryPreflights,
  scenario = runDockerSelfScenario,
} = {}) => {
  await preflight()
  return scenario()
}

const entryPath = process.argv[1]
if (
  entryPath !== undefined &&
  pathToFileURL(entryPath).href === import.meta.url
) {
  await main()
}
