import { setTimeout as delay } from 'node:timers/promises'
import {
  assert,
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
  const session = await expectOk(cli, 'workspace-bound session init', '', [
    'session',
    'init',
    '--worker',
    `agent_bound_${runId}`,
    '--name',
    'Bound agent',
    '--permissions',
    'work:create',
    '--workspace',
    allowed.id,
  ])
  assert(
    JSON.stringify(session.workspace_ids) === JSON.stringify([allowed.id]),
    'workspace-bound session did not report its binding',
  )
  await expectOk(cli, 'bound workspace write', session.session_id, [
    'work',
    'create',
    'Allowed bound work',
    '--workspace',
    allowed.id,
  ])
  await expectError(
    cli,
    'cross-workspace bound write',
    session.session_id,
    ['work', 'create', 'Denied bound work', '--workspace', denied.id],
    'forbidden',
  )
}
