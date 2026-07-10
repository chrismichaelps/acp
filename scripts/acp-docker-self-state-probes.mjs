import { setTimeout as delay } from 'node:timers/promises'
import {
  assert,
  containerFetch,
  dockerOk,
  expectError,
  expectOk,
  initAgent,
  makeCli,
  waitForReady,
} from './acp-docker-self-support.mjs'

export const proveRestartPersistence = async ({
  container,
  scenario,
  cli,
  streamChild,
}) => {
  await dockerOk(['restart', container])
  await waitForReady(container)
  await Promise.race([
    new Promise((resolve) => streamChild.once('close', resolve)),
    delay(2_000),
  ])
  const work = await expectOk(
    cli,
    'work persisted after restart',
    scenario.owner.token,
    ['work', 'get', scenario.work.id],
  )
  const content = await expectOk(
    cli,
    'artifact content persisted after restart',
    scenario.owner.token,
    ['artifact', 'content', scenario.artifact.id],
  )
  const grill = await expectOk(
    cli,
    'grill persisted after restart',
    scenario.owner.token,
    ['grill', 'get', scenario.grill.id],
  )
  assert(work.state === 'completed', 'work state did not survive restart')
  assert(
    content.content === '{"ok":true}',
    'artifact content did not survive restart',
  )
  assert(grill.grill.state === 'passed', 'grill state did not survive restart')
}

export const proveAuth = async ({ image, authContainer, runId }) => {
  await dockerOk([
    'run',
    '-d',
    '--name',
    authContainer,
    '-e',
    'ACP_REQUIRE_AUTH=true',
    image,
  ])
  await waitForReady(authContainer)
  const cli = makeCli(authContainer)
  await expectError(
    cli,
    'unauthenticated workspace list',
    '',
    ['workspace', 'list'],
    'unauthorized',
  )
  const owner = await initAgent(cli, 'auth_owner', runId)
  const allowed = await expectOk(cli, 'auth allowed workspace', owner.token, [
    'workspace',
    'create',
    '--name',
    'Allowed workspace',
    '--kind',
    'container',
    '--uri',
    `docker://allowed/${runId}`,
  ])
  const denied = await expectOk(cli, 'auth denied workspace', owner.token, [
    'workspace',
    'create',
    '--name',
    'Denied workspace',
    '--kind',
    'container',
    '--uri',
    `docker://denied/${runId}`,
  ])
  const session = await containerFetch(
    authContainer,
    '/v1/session/initialize',
    {
      method: 'POST',
      body: {
        worker: {
          id: `agent_bound_${runId}`,
          name: 'Bound agent',
          kind: 'agent',
        },
        permissions: ['work:create'],
        workspace_ids: [allowed.id],
      },
    },
  )
  assert(
    session.status === 200,
    'workspace-bound session initialization failed',
  )
  const token = session.body.session_id
  const accepted = await containerFetch(authContainer, '/v1/work', {
    method: 'POST',
    token,
    body: { workspace_id: allowed.id, title: 'Allowed bound work' },
  })
  const rejected = await containerFetch(authContainer, '/v1/work', {
    method: 'POST',
    token,
    body: { workspace_id: denied.id, title: 'Denied bound work' },
  })
  assert(accepted.status === 201, 'bound workspace write was rejected')
  assert(
    rejected.status === 403 && rejected.body.error.code === 'forbidden',
    'cross-workspace bound write was not forbidden',
  )
}
