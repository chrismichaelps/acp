import { setTimeout as delay } from 'node:timers/promises'
import {
  assert,
  dockerOk,
  expectError,
  expectOk,
  expectSuccess,
  initAgent,
  makeCli,
  waitForReady,
} from './acp-docker-self-support.mjs'
import {
  reviewerMinimumV01Permissions,
  workerLoopPermissions,
} from './check-agent-doc-permissions.mjs'

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

export const proveAuth = async ({
  image,
  authContainer,
  authVolume,
  runId,
}) => {
  await dockerOk(['volume', 'create', authVolume])
  await dockerOk([
    'run',
    '-d',
    '--name',
    authContainer,
    '-e',
    'ACP_REQUIRE_AUTH=true',
    '-e',
    'ACP_STORAGE_ADAPTER=sqlite',
    '-e',
    'ACP_SQLITE_PATH=/data/acp.sqlite',
    '-v',
    `${authVolume}:/data`,
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

  await dockerOk(['rm', '-f', authContainer])
  await dockerOk([
    'run',
    '-d',
    '--name',
    authContainer,
    '-e',
    'ACP_REQUIRE_AUTH=true',
    '-e',
    'ACP_REQUIRE_WORKSPACE_BINDINGS=true',
    '-e',
    'ACP_STORAGE_ADAPTER=sqlite',
    '-e',
    'ACP_SQLITE_PATH=/data/acp.sqlite',
    '-v',
    `${authVolume}:/data`,
    image,
  ])
  await waitForReady(authContainer)
  const strictCli = makeCli(authContainer)

  const session = await expectOk(
    strictCli,
    'workspace-bound session init',
    '',
    [
      'session',
      'init',
      '--worker',
      `agent_bound_${runId}`,
      '--name',
      'Bound agent',
      '--permissions',
      workerLoopPermissions.join(','),
      '--workspace',
      allowed.id,
    ],
  )
  assert(
    JSON.stringify(session.workspace_ids) === JSON.stringify([allowed.id]),
    'workspace-bound session did not report its binding',
  )
  const reviewer = await expectOk(
    strictCli,
    'bound reviewer session init',
    '',
    [
      'session',
      'init',
      '--worker',
      `agent_reviewer_${runId}`,
      '--name',
      'Bound reviewer',
      '--permissions',
      reviewerMinimumV01Permissions.join(','),
      '--workspace',
      allowed.id,
    ],
  )
  const work = await expectOk(
    strictCli,
    'bound worker creates work',
    session.session_id,
    [
      'work',
      'create',
      'Documented auth worker loop',
      '--workspace',
      allowed.id,
    ],
  )
  await expectOk(strictCli, 'bound worker lists work', session.session_id, [
    'work',
    'list',
    '--workspace',
    allowed.id,
  ])
  await expectOk(strictCli, 'bound worker claims work', session.session_id, [
    'work',
    'claim',
    work.id,
    '--worker',
    `agent_bound_${runId}`,
  ])
  const lease = await expectOk(
    strictCli,
    'bound worker leases file',
    session.session_id,
    [
      'lease',
      'request',
      '--workspace',
      allowed.id,
      '--holder',
      `agent_bound_${runId}`,
      '--kind',
      'file',
      '--uri',
      `file:///repo/auth-${runId}.ts`,
      '--ttl',
      '300',
    ],
  )
  await expectOk(strictCli, 'bound worker starts work', session.session_id, [
    'work',
    'update',
    work.id,
    '--state',
    'running',
  ])
  await expectOk(strictCli, 'bound worker checkpoints', session.session_id, [
    'checkpoint',
    'create',
    '--workspace',
    allowed.id,
    '--work',
    work.id,
    '--summary',
    'documented auth loop checkpoint',
  ])
  await expectOk(strictCli, 'bound worker leaves memory', session.session_id, [
    'memory',
    'create',
    '--workspace',
    allowed.id,
    '--work',
    work.id,
    '--kind',
    'handoff',
    '--key',
    `${work.id}-handoff`,
    '--summary',
    'documented auth loop handoff',
    '--content',
    'auth-on worker lifecycle reached review',
  ])
  const artifact = await expectOk(
    strictCli,
    'bound worker attaches artifact',
    session.session_id,
    [
      'artifact',
      'pr',
      '--workspace',
      allowed.id,
      '--work',
      work.id,
      '--url',
      `https://example.com/acp/auth-${runId}`,
      '--summary',
      'documented auth loop artifact',
    ],
  )
  const review = await expectOk(
    strictCli,
    'bound worker requests review',
    session.session_id,
    ['review', 'request', '--work', work.id, '--by', `agent_bound_${runId}`],
  )
  await expectOk(strictCli, 'bound worker resumes work', session.session_id, [
    'work',
    'resume',
    work.id,
    '--budget',
    '8',
  ])
  const verdictOnly = await expectOk(
    strictCli,
    'verdict-only reviewer session init',
    '',
    [
      'session',
      'init',
      '--worker',
      `agent_verdict_only_${runId}`,
      '--name',
      'Verdict-only reviewer',
      '--permissions',
      'review:approve,review:reject,review:request_changes,review:cancel',
      '--workspace',
      allowed.id,
    ],
  )
  const commentArgs = [
    'review',
    'comment',
    '--review',
    review.id,
    '--work',
    work.id,
    '--workspace',
    allowed.id,
    '--artifact',
    artifact.id,
    '--file',
    'src/auth.ts',
    '--side',
    'new',
    '--body',
    'documented reviewer finding',
  ]
  await expectError(
    strictCli,
    'verdict-only reviewer cannot comment',
    verdictOnly.session_id,
    commentArgs,
    'forbidden',
  )
  const reviewerMemoryArgs = [
    'memory',
    'create',
    '--workspace',
    allowed.id,
    '--work',
    work.id,
    '--kind',
    'observation',
    '--key',
    `${work.id}-review-finding`,
    '--summary',
    'documented reviewer durable finding',
    '--content',
    'reviewer authorization exercised independently',
  ]
  await expectError(
    strictCli,
    'verdict-only reviewer cannot persist finding',
    verdictOnly.session_id,
    reviewerMemoryArgs,
    'forbidden',
  )
  const comment = await expectOk(
    strictCli,
    'bound reviewer comments',
    reviewer.session_id,
    commentArgs,
  )
  await expectOk(
    strictCli,
    'bound reviewer resolves comment',
    reviewer.session_id,
    ['review', 'comment', 'resolve', comment.id],
  )
  await expectOk(
    strictCli,
    'bound reviewer persists finding',
    reviewer.session_id,
    reviewerMemoryArgs,
  )
  await expectOk(
    strictCli,
    'bound reviewer reads memory',
    reviewer.session_id,
    ['memory', 'list', '--workspace', allowed.id, '--work', work.id],
  )
  await expectOk(
    strictCli,
    'bound reviewer replays events',
    reviewer.session_id,
    ['events', 'list', '--workspace', allowed.id, '--after', '0'],
  )
  await expectOk(strictCli, 'bound reviewer approves', reviewer.session_id, [
    'review',
    'approve',
    review.id,
    '--met',
    'auth-on-lifecycle',
  ])
  await expectOk(strictCli, 'bound worker completes work', session.session_id, [
    'work',
    'update',
    work.id,
    '--state',
    'completed',
  ])
  await expectSuccess(
    strictCli,
    'bound worker releases lease',
    session.session_id,
    ['lease', 'release', lease.id],
  )
  const events = await expectOk(
    strictCli,
    'bound worker replays events',
    session.session_id,
    ['events', 'list', '--workspace', allowed.id, '--after', '0'],
  )
  for (const eventType of [
    'work.created',
    'work.claimed',
    'work.started',
    'checkpoint.created',
    'memory.created',
    'artifact.created',
    'review.requested',
    'review.approved',
    'work.completed',
    'lease.released',
  ]) {
    assert(
      events.some((event) => {
        if (event.type !== eventType) return false
        return eventType === 'lease.released'
          ? event.data?.lease_id === lease.id
          : event.work_id === work.id
      }),
      `auth-on lifecycle is missing ${eventType}`,
    )
  }

  await expectError(
    strictCli,
    'cross-workspace bound write',
    session.session_id,
    ['work', 'create', 'Denied bound work', '--workspace', denied.id],
    'forbidden',
  )
  const narrow = await expectOk(strictCli, 'narrow bound session init', '', [
    'session',
    'init',
    '--worker',
    `agent_narrow_${runId}`,
    '--name',
    'Narrow agent',
    '--permissions',
    'work:create',
    '--workspace',
    allowed.id,
  ])
  await expectError(
    strictCli,
    'permission denial',
    narrow.session_id,
    ['work', 'list', '--workspace', allowed.id],
    'forbidden',
  )
}
