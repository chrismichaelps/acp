#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import {
  assert,
  containerFetch,
  docker,
  dockerOk,
  expectOk,
  expectSuccess,
  initAgent,
  makeCli,
  waitForReady,
} from './acp-docker-self-support.mjs'
import { runBackupScenario } from './acp-docker-self-backup-scenario.mjs'
import { runFeatureScenario } from './acp-docker-self-scenario.mjs'
import {
  proveAuth,
  proveRestartPersistence,
  proveTrustedIssuance,
} from './acp-docker-self-state-probes.mjs'
import { proveTransports } from './acp-docker-self-transport-probes.mjs'

const image = process.env.ACP_DOCKER_IMAGE ?? 'acp:docker-self-dogfood'
const runId = process.env.ACP_DOGFOOD_RUN_ID ?? Date.now().toString(36)
const container = `acp-docker-self-${runId}`
const authContainer = `${container}-auth`
const authVolume = `${authContainer}-data`
const volume = `${container}-data`
const quickstartContainer = `acp-quickstart-${runId}`
const quickstartVolume = `${quickstartContainer}-data`

const cleanup = async () => {
  await docker(['rm', '-f', container]).catch(() => undefined)
  await docker(['rm', '-f', authContainer]).catch(() => undefined)
  await docker(['volume', 'rm', authVolume]).catch(() => undefined)
  await docker(['volume', 'rm', volume]).catch(() => undefined)
  await docker(['rm', '-f', quickstartContainer]).catch(() => undefined)
  await docker(['volume', 'rm', quickstartVolume]).catch(() => undefined)
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

export const isMissingDockerResource = (stderr) =>
  /no such (?:container|volume|image)/iu.test(stderr)

const removeDockerResource = async (args) => {
  const result = await docker(args)
  if (result.ok || isMissingDockerResource(result.stderr)) return
  throw new Error(
    `docker ${args.join(' ')} exited ${String(result.code)}: ${result.stderr || result.stdout}`,
  )
}

export const resolveQuickstartImage = ({ skipBuild, aggregateImage, runId }) =>
  skipBuild ? aggregateImage : `acp:quickstart-${runId}`

export const cleanupQuickstartResources = async ({
  containerName,
  volumeName,
  imageName,
  ownsImage,
  remove = removeDockerResource,
}) => {
  const [containerOutcome] = await Promise.allSettled([
    remove(['rm', '-f', containerName]),
  ])
  const laterOutcomes = await Promise.allSettled(
    [
      ['volume', 'rm', volumeName],
      ...(ownsImage ? [['image', 'rm', imageName]] : []),
    ].map((args) => remove(args)),
  )
  const outcomes = [containerOutcome, ...laterOutcomes]
  const failures = outcomes
    .filter((outcome) => outcome.status === 'rejected')
    .map((outcome) => outcome.reason)
  if (failures.length === 1) throw failures[0]
  if (failures.length > 1)
    throw new AggregateError(failures, 'quickstart resource cleanup failed')
}

export const runWithQuickstartCleanup = async ({
  operation,
  cleanup,
  publish,
}) => {
  let result
  let operationError
  try {
    result = await operation()
  } catch (error) {
    operationError = error
  }

  let cleanupError
  try {
    await cleanup()
  } catch (error) {
    cleanupError = error
  }

  if (operationError !== undefined && cleanupError !== undefined) {
    const cleanupErrors =
      cleanupError instanceof AggregateError
        ? cleanupError.errors
        : [cleanupError]
    throw new AggregateError(
      [operationError, ...cleanupErrors],
      'quickstart operation and cleanup failed',
    )
  }
  if (operationError !== undefined) throw operationError
  if (cleanupError !== undefined) throw cleanupError
  publish(result)
  return result
}

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

export const classifyQuickstartLeaseRace = (results) => {
  const winners = results.filter(({ response }) => response.status === 201)
  const conflicts = results.filter(
    ({ response }) =>
      response.status === 409 &&
      response.body?.error?.code === 'lease_conflict',
  )
  assert(
    winners.length === 1,
    'lease race must have exactly one HTTP 201 winner',
  )
  assert(
    conflicts.length === 1,
    'lease race must have exactly one HTTP 409 lease_conflict loser',
  )
  assert(
    winners[0].response.body?.state === 'active',
    'lease winner did not receive an active lease',
  )
  return { winner: winners[0], conflict: conflicts[0] }
}

export const verifyQuickstartReplayTail = (savedSeq, events) => {
  assert(
    Number.isInteger(savedSeq) && savedSeq > 0,
    'saved event cursor must be a positive integer',
  )
  assert(events.length === 2, 'replay tail must contain checkpoint and handoff')
  assert(
    events.every((event) => event.seq > savedSeq),
    'replay included an event at or before the saved cursor',
  )
  assert(
    events.every(
      (event, index) => index === 0 || event.seq > events[index - 1].seq,
    ),
    'replay tail is not strictly monotonic',
  )
  assert(
    JSON.stringify(events.map((event) => event.type)) ===
      JSON.stringify(['checkpoint.created', 'memory.created']),
    'replay tail did not contain the expected checkpoint and handoff events',
  )
  return events.map((event) => event.seq)
}

const narrate = (message) => console.log(`[ACP quickstart] ${message}`)

export const runRecoveryQuickstart = async ({ skipBuild = false } = {}) => {
  const scenarioImage = resolveQuickstartImage({
    skipBuild,
    aggregateImage: image,
    runId,
  })
  const ownsImage = !skipBuild
  const cleanupQuickstart = () =>
    cleanupQuickstartResources({
      containerName: quickstartContainer,
      volumeName: quickstartVolume,
      imageName: scenarioImage,
      ownsImage,
    })

  await cleanupQuickstart()
  return runWithQuickstartCleanup({
    operation: async () => {
      if (skipBuild) narrate('Reusing the production ACP image built by CI.')
      else {
        narrate('Building the production ACP image.')
        await runVisible('docker', ['build', '-t', scenarioImage, '.'])
      }
      await dockerOk(['volume', 'create', quickstartVolume])
      await dockerOk([
        'run',
        '-d',
        '--name',
        quickstartContainer,
        '-e',
        'ACP_STORAGE_ADAPTER=sqlite',
        '-e',
        'ACP_SQLITE_PATH=/data/acp.sqlite',
        '-v',
        `${quickstartVolume}:/data`,
        scenarioImage,
      ])
      await waitForReady(quickstartContainer)

      const cli = makeCli(quickstartContainer)
      const [workerA, workerB, reviewer] = await Promise.all([
        initAgent(cli, 'quickstart_a', runId),
        initAgent(cli, 'quickstart_b', runId),
        initAgent(cli, 'quickstart_reviewer', runId),
      ])
      const workspace = await expectOk(
        cli,
        'quickstart workspace create',
        workerA.token,
        [
          'workspace',
          'create',
          '--name',
          `ACP recovery quickstart ${runId}`,
          '--kind',
          'git_repository',
          '--uri',
          `file:///workspace/acp-quickstart-${runId}`,
          '--default-branch',
          'main',
        ],
      )
      const work = await expectOk(
        cli,
        'quickstart work create',
        workerA.token,
        [
          'work',
          'create',
          'Recover coordinated work after restart',
          '--workspace',
          workspace.id,
          '--priority',
          'high',
        ],
      )

      narrate('Racing two workers for one file lease.')
      const resource = {
        kind: 'file',
        uri: `file:///workspace/acp-quickstart-${runId}/src/recovery.ts`,
      }
      const race = await Promise.all(
        [workerA, workerB].map(async (agent) => ({
          agent,
          response: await containerFetch(quickstartContainer, '/v1/leases', {
            method: 'POST',
            token: agent.token,
            body: {
              workspace_id: workspace.id,
              work_id: work.id,
              holder: agent.worker,
              resource,
              ttl_seconds: 600,
            },
          }),
        })),
      )
      const { winner, conflict } = classifyQuickstartLeaseRace(race)
      const lease = winner.response.body
      narrate(
        `${winner.agent.worker} won; ${conflict.agent.worker} received HTTP 409 lease_conflict.`,
      )

      await expectOk(cli, 'quickstart work claim', winner.agent.token, [
        'work',
        'claim',
        work.id,
        '--worker',
        winner.agent.worker,
      ])
      await expectOk(cli, 'quickstart work running', winner.agent.token, [
        'work',
        'update',
        work.id,
        '--state',
        'running',
      ])
      const beforeRestart = await expectOk(
        cli,
        'quickstart initial event cursor',
        winner.agent.token,
        ['events', 'list', '--workspace', workspace.id, '--after', '0'],
      )
      const savedSeq = beforeRestart.at(-1)?.seq
      assert(
        Number.isInteger(savedSeq) && savedSeq > 0,
        'quickstart did not capture a nonzero event cursor',
      )

      const checkpoint = await expectOk(
        cli,
        'quickstart checkpoint create',
        winner.agent.token,
        [
          'checkpoint',
          'create',
          '--workspace',
          workspace.id,
          '--work',
          work.id,
          '--summary',
          'Lease acquired; resume from the saved event cursor after restart.',
        ],
      )
      const handoffKey = `quickstart.${runId}.handoff`
      const handoff = await expectOk(
        cli,
        'quickstart handoff create',
        winner.agent.token,
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
          handoffKey,
          '--summary',
          'Recovery quickstart handoff',
          '--content',
          'The file lease is active and the work must pass review before completion.',
          '--labels',
          'quickstart,recovery,handoff',
        ],
      )

      narrate(`Restarting ACP mid-work with saved cursor ${String(savedSeq)}.`)
      await dockerOk(['restart', quickstartContainer])
      await waitForReady(quickstartContainer)
      const replay = await expectOk(
        cli,
        'quickstart event replay after restart',
        winner.agent.token,
        [
          'events',
          'list',
          '--workspace',
          workspace.id,
          '--after',
          String(savedSeq),
        ],
      )
      const replayedSeqs = verifyQuickstartReplayTail(savedSeq, replay)
      const recovered = await expectOk(
        cli,
        'quickstart work resume after restart',
        winner.agent.token,
        ['work', 'resume', work.id],
      )
      const recoveredHandoffs = await expectOk(
        cli,
        'quickstart handoff read after restart',
        winner.agent.token,
        [
          'memory',
          'list',
          '--workspace',
          workspace.id,
          '--work',
          work.id,
          '--kind',
          'handoff',
          '--key',
          handoffKey,
        ],
      )
      assert(
        recovered.work.state === 'running',
        'active work did not survive restart',
      )
      assert(
        recovered.latest_checkpoint.id === checkpoint.id,
        'checkpoint did not survive restart',
      )
      assert(
        recoveredHandoffs.some((record) => record.id === handoff.id),
        'handoff did not survive restart',
      )
      narrate(
        `Replayed event tail ${replayedSeqs.join(', ')} and restored handoff.`,
      )

      const review = await expectOk(
        cli,
        'quickstart review request',
        winner.agent.token,
        [
          'review',
          'request',
          '--work',
          work.id,
          '--by',
          winner.agent.worker,
          '--reviewer',
          reviewer.worker,
        ],
      )
      const approved = await expectOk(
        cli,
        'quickstart review approve',
        reviewer.token,
        [
          'review',
          'approve',
          review.id,
          '--met',
          'lease,restart,replay,handoff',
        ],
      )
      assert(
        approved.state === 'approved',
        'quickstart review was not approved',
      )
      await expectSuccess(cli, 'quickstart lease release', winner.agent.token, [
        'lease',
        'release',
        lease.id,
      ])
      const completed = await expectOk(
        cli,
        'quickstart work complete',
        winner.agent.token,
        ['work', 'update', work.id, '--state', 'completed'],
      )
      const leases = await expectOk(
        cli,
        'quickstart lease readback',
        reviewer.token,
        ['lease', 'list', '--workspace', workspace.id],
      )
      assert(
        completed.state === 'completed',
        'quickstart work did not complete',
      )
      assert(
        leases.find((item) => item.id === lease.id)?.state === 'released',
        'quickstart left its file lease active',
      )
      narrate('Review approved; lease released; work completed.')

      const result = {
        ok: true,
        run_id: runId,
        image: scenarioImage,
        workspace_id: workspace.id,
        work_id: work.id,
        lease_id: lease.id,
        lease_winner: winner.agent.worker,
        conflict_worker: conflict.agent.worker,
        conflict_status: conflict.response.status,
        conflict_code: conflict.response.body.error.code,
        saved_seq: savedSeq,
        replayed_seqs: replayedSeqs,
        checkpoint_id: checkpoint.id,
        handoff_id: handoff.id,
        review_id: review.id,
        review_state: approved.state,
        work_state: completed.state,
        lease_state: 'released',
      }
      return result
    },
    cleanup: cleanupQuickstart,
    publish: (result) => console.log(JSON.stringify(result, null, 2)),
  })
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
    await proveAuth({ image, authContainer, authVolume, runId })
    await proveTrustedIssuance({ image, authContainer, authVolume, runId })

    await dockerOk(['rm', '-f', container])
    await dockerOk(['rm', '-f', authContainer])
    await dockerOk(['volume', 'rm', authVolume])
    await dockerOk(['volume', 'rm', volume])

    const reuseImage = { ACP_DOCKER_SKIP_BUILD: 'true' }
    await runRecoveryQuickstart({ skipBuild: true })
    await runBackupScenario({ skipBuild: true })
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
          auth: [
            'required-bearer',
            'permission-denial',
            'workspace-binding',
            'complete-worker-lifecycle',
            'trusted-session-issuance',
            'revision-revocation',
            'websocket-subscription-authorization',
          ],
          ha: true,
          edge: true,
          backup: true,
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
  await main({
    ...(process.argv.includes('--quickstart')
      ? { scenario: runRecoveryQuickstart }
      : {}),
  })
}
