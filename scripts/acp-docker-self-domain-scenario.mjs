import {
  assert,
  expectError,
  expectOk,
  expectSuccess,
  initAgent,
} from './acp-docker-self-support.mjs'

export const runDomainScenario = async (cli, runId) => {
  const owner = await initAgent(cli, 'owner', runId)
  const contender = await initAgent(cli, 'contender', runId)
  const reader = await initAgent(cli, 'reader', runId, [
    'worker:read',
    'workspace:read',
    'event:read',
    'memory:read',
  ])

  assert(
    owner.session.capabilities.supports_signed_review_approvals === true,
    'host did not advertise signed review approvals',
  )
  const workers = await expectOk(cli, 'worker list', owner.token, [
    'worker',
    'list',
  ])
  assert(
    workers.some((worker) => worker.id === owner.worker),
    'owner missing',
  )
  const ownerReadback = await expectOk(cli, 'worker get', owner.token, [
    'worker',
    'get',
    owner.worker,
  ])
  assert(ownerReadback.id === owner.worker, 'worker get returned wrong worker')

  const workspace = await expectOk(cli, 'workspace create', owner.token, [
    'workspace',
    'create',
    '--name',
    `Docker self ${runId}`,
    '--kind',
    'container',
    '--uri',
    `docker://acp-self/${runId}`,
    '--default-branch',
    'main',
  ])
  const renamed = await expectOk(cli, 'workspace update', owner.token, [
    'workspace',
    'update',
    workspace.id,
    '--name',
    `Docker self verified ${runId}`,
    '--kind',
    'container',
    '--uri',
    `docker://acp-self/${runId}`,
    '--default-branch',
    'main',
  ])
  assert(
    renamed.name.includes('verified'),
    'workspace update was not persisted',
  )
  const workspaceList = await expectOk(cli, 'workspace list', reader.token, [
    'workspace',
    'list',
  ])
  assert(
    workspaceList.some((item) => item.id === workspace.id),
    'workspace missing from list',
  )
  await expectError(
    cli,
    'read-only workspace create',
    reader.token,
    [
      'workspace',
      'create',
      '--name',
      'Denied',
      '--kind',
      'container',
      '--uri',
      'docker://denied',
    ],
    'forbidden',
  )

  const createWork = (title) =>
    expectOk(cli, `work create (${title})`, owner.token, [
      'work',
      'create',
      title,
      '--workspace',
      workspace.id,
      '--priority',
      'urgent',
      '--description',
      `Docker self-test ${runId}`,
    ])
  const runWork = async (title) => {
    const work = await createWork(title)
    await expectOk(cli, `work claim (${title})`, owner.token, [
      'work',
      'claim',
      work.id,
      '--worker',
      owner.worker,
    ])
    await expectOk(cli, `work running (${title})`, owner.token, [
      'work',
      'update',
      work.id,
      '--state',
      'running',
    ])
    return work
  }

  const work = await createWork(`Complete Docker surface ${runId}`)
  await expectError(
    cli,
    'invalid direct completion',
    owner.token,
    ['work', 'update', work.id, '--state', 'completed'],
    'invalid_state_transition',
  )
  await expectOk(cli, 'work claim', owner.token, [
    'work',
    'claim',
    work.id,
    '--worker',
    owner.worker,
  ])
  await expectError(
    cli,
    'second work claim',
    contender.token,
    ['work', 'claim', work.id, '--worker', contender.worker],
    'claim_conflict',
  )
  await expectOk(cli, 'work running', owner.token, [
    'work',
    'update',
    work.id,
    '--state',
    'running',
  ])
  const workReadback = await expectOk(cli, 'work get', reader.token, [
    'work',
    'get',
    work.id,
  ])
  assert(workReadback.state === 'running', 'work get missed running state')
  const filteredWork = await expectOk(cli, 'work list filters', reader.token, [
    'work',
    'list',
    '--workspace',
    workspace.id,
    '--state',
    'running',
    '--priority',
    'urgent',
    '--assigned-to',
    owner.worker,
  ])
  assert(
    filteredWork.some((item) => item.id === work.id),
    'work filter missed',
  )

  const lease = await expectOk(cli, 'lease request', owner.token, [
    'lease',
    'request',
    '--workspace',
    workspace.id,
    '--holder',
    owner.worker,
    '--kind',
    'worktree',
    '--uri',
    `worktree://self/${runId}`,
    '--ttl',
    '600',
  ])
  await expectError(
    cli,
    'lease conflict',
    contender.token,
    [
      'lease',
      'request',
      '--workspace',
      workspace.id,
      '--holder',
      contender.worker,
      '--kind',
      'worktree',
      '--uri',
      `worktree://self/${runId}`,
    ],
    'lease_conflict',
  )
  const renewed = await expectOk(cli, 'lease renew', owner.token, [
    'lease',
    'renew',
    lease.id,
    '--ttl',
    '900',
  ])
  assert(renewed.state === 'active', 'renewed lease was not active')
  const held = await expectOk(cli, 'lease list holder', reader.token, [
    'lease',
    'list',
    '--workspace',
    workspace.id,
    '--holder',
    owner.worker,
  ])
  assert(
    held.some((item) => item.id === lease.id),
    'lease list missed holder',
  )
  await expectSuccess(cli, 'lease release', owner.token, [
    'lease',
    'release',
    lease.id,
  ])
  const revokedLease = await expectOk(
    cli,
    'lease request for revoke',
    owner.token,
    [
      'lease',
      'request',
      '--workspace',
      workspace.id,
      '--holder',
      owner.worker,
      '--kind',
      'file',
      '--uri',
      `file:///tmp/self-${runId}`,
    ],
  )
  const revoked = await expectOk(cli, 'lease revoke', owner.token, [
    'lease',
    'revoke',
    revokedLease.id,
  ])
  assert(revoked.state === 'revoked', 'lease revoke did not persist')

  const checkpoint = await expectOk(cli, 'checkpoint create', owner.token, [
    'checkpoint',
    'create',
    '--workspace',
    workspace.id,
    '--work',
    work.id,
    '--summary',
    'Complete Docker surface checkpoint',
  ])
  const checkpointsForWork = await expectOk(
    cli,
    'checkpoint list work',
    reader.token,
    ['checkpoint', 'list', '--work', work.id],
  )
  const checkpointsForWorkspace = await expectOk(
    cli,
    'checkpoint list workspace',
    reader.token,
    ['checkpoint', 'list', '--workspace', workspace.id],
  )
  const latest = await expectOk(cli, 'checkpoint latest', reader.token, [
    'checkpoint',
    'latest',
    '--work',
    work.id,
  ])
  assert(
    latest.id === checkpoint.id &&
      checkpointsForWork.length === 1 &&
      checkpointsForWorkspace.some((item) => item.id === checkpoint.id),
    'checkpoint read surfaces disagreed',
  )

  const memory = await expectOk(cli, 'memory create', owner.token, [
    'memory',
    'create',
    '--workspace',
    workspace.id,
    '--work',
    work.id,
    '--kind',
    'handoff',
    '--key',
    `docker.self.${runId}`,
    '--summary',
    'Docker self-test handoff',
    '--content',
    'All public command families are being verified.',
    '--labels',
    'docker,self-test,handoff',
  ])
  const memories = await expectOk(cli, 'memory list filters', reader.token, [
    'memory',
    'list',
    '--workspace',
    workspace.id,
    '--after',
    '0',
    '--limit',
    '5',
    '--work',
    work.id,
    '--kind',
    'handoff',
    '--key',
    `docker.self.${runId}`,
    '--label',
    'self-test',
  ])
  assert(
    memories.length === 1 && memories[0].id === memory.id,
    'memory filters',
  )

  return {
    owner,
    reader,
    workers,
    workspace,
    workspaceList,
    runWork,
    work,
    checkpoint,
  }
}
