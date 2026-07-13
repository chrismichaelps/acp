import { setTimeout as delay } from 'node:timers/promises'
import {
  assert,
  containerFetch,
  dockerOk,
  expectError,
  expectOk,
  expectSuccess,
  initAgent,
  makeCli,
  stdioRpc,
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

  const stdioReviewer = await stdioRpc(authContainer, {
    jsonrpc: '2.0',
    id: 'docker-stdio-reviewer',
    method: 'session.initialize',
    params: {
      worker: {
        id: `agent_reviewer_${runId}`,
        name: 'Docker stdio reviewer',
        kind: 'agent',
      },
      permissions: reviewerMinimumV01Permissions,
      workspace_ids: [allowed.id],
    },
  })
  const reviewer = stdioReviewer.result
  assert(
    stdioReviewer.id === 'docker-stdio-reviewer' &&
      reviewer?.session_id?.startsWith('session_') &&
      JSON.stringify(reviewer?.permissions) ===
        JSON.stringify(reviewerMinimumV01Permissions) &&
      JSON.stringify(reviewer?.workspace_ids) === JSON.stringify([allowed.id]),
    'stdio reviewer did not echo its role permission and workspace binding',
  )
  const stdioRespondent = await stdioRpc(authContainer, {
    jsonrpc: '2.0',
    id: 'docker-stdio-respondent',
    method: 'session.initialize',
    params: {
      worker: {
        id: `agent_stdio_respondent_${runId}`,
        name: 'Docker stdio respondent',
        kind: 'agent',
      },
      permissions: ['review:respond'],
      workspace_ids: [allowed.id],
    },
  })
  assert(
    stdioRespondent.id === 'docker-stdio-respondent' &&
      stdioRespondent.result?.session_id?.startsWith('session_') &&
      JSON.stringify(stdioRespondent.result?.permissions) ===
        JSON.stringify(['review:respond']) &&
      JSON.stringify(stdioRespondent.result?.workspace_ids) ===
        JSON.stringify([allowed.id]),
    'stdio respondent did not echo its role permission and workspace binding',
  )
  const dualScope = await stdioRpc(authContainer, {
    jsonrpc: '2.0',
    id: 'docker-stdio-dual-scope',
    method: 'session.initialize',
    params: {
      worker: {
        id: `agent_stdio_dual_${runId}`,
        name: 'Docker stdio dual role',
        kind: 'agent',
      },
      permissions: ['review:respond', 'review:collaborate'],
      workspace_ids: [allowed.id],
    },
  })
  assert(
    dualScope.id === 'docker-stdio-dual-scope' &&
      dualScope.result === undefined &&
      JSON.stringify(dualScope.error).includes(
        'review:respond and review:collaborate are mutually exclusive',
      ),
    'stdio session initialization accepted mutually exclusive review roles',
  )

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
  assert(
    JSON.stringify(session.permissions) ===
      JSON.stringify(workerLoopPermissions),
    'workspace-bound session did not echo worker permissions',
  )
  const legacyWriter = await expectOk(
    strictCli,
    'legacy workspace writer session init',
    '',
    [
      'session',
      'init',
      '--worker',
      `agent_legacy_writer_${runId}`,
      '--name',
      'Legacy workspace writer',
      '--permissions',
      'workspace:write',
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
  const mismatch = await containerFetch(
    authContainer,
    `/v1/reviews/${review.id}/comments`,
    {
      method: 'POST',
      token: reviewer.session_id,
      body: {
        review_id: 'review_wrong',
        work_id: 'work_wrong',
        workspace_id: 'workspace_wrong',
        target: {
          artifact_id: artifact.id,
          file: 'src/auth.ts',
          side: 'new',
        },
        body: 'must not persist',
      },
    },
  )
  assert(mismatch.status === 400, 'review identity mismatch was not rejected')
  assert(
    JSON.stringify(mismatch.body?.error?.details?.value?.issues) ===
      JSON.stringify([
        'review_id must match the target review',
        'work_id must match the target review work',
        'workspace_id must match the target review workspace',
      ]),
    'review identity mismatch issues were not deterministic',
  )
  const grill = await expectOk(
    strictCli,
    'bound reviewer opens grill',
    reviewer.session_id,
    [
      'grill',
      'open',
      '--review',
      review.id,
      '--work',
      work.id,
      '--workspace',
      allowed.id,
    ],
  )
  const question = await expectOk(
    strictCli,
    'bound reviewer asks grill question',
    reviewer.session_id,
    [
      'grill',
      'ask',
      grill.id,
      '--severity',
      'blocker',
      '--prompt',
      'Why does the role split hold?',
    ],
  )
  await expectError(
    strictCli,
    'collaborator cannot answer',
    reviewer.session_id,
    ['grill', 'answer', question.id, '--answer', 'This answer must be denied.'],
    'forbidden',
  )
  await expectOk(strictCli, 'bound worker answers', session.session_id, [
    'grill',
    'answer',
    question.id,
    '--answer',
    'The worker and reviewer use mutually exclusive role tokens.',
  ])
  await expectError(
    strictCli,
    'respondent cannot set verdict',
    session.session_id,
    ['grill', 'verdict', question.id, '--accept'],
    'forbidden',
  )
  await expectError(
    strictCli,
    'respondent cannot evaluate',
    session.session_id,
    ['grill', 'evaluate', grill.id],
    'forbidden',
  )
  await expectOk(
    strictCli,
    'bound reviewer accepts answer',
    reviewer.session_id,
    ['grill', 'verdict', question.id, '--accept'],
  )
  const evaluation = await expectOk(
    strictCli,
    'bound reviewer evaluates grill',
    reviewer.session_id,
    ['grill', 'evaluate', grill.id],
  )
  assert(evaluation.outcome === 'pass', 'role-separated grill did not pass')

  const legacyMutations = [
    {
      path: `/v1/reviews/${review.id}/comments`,
      body: {
        review_id: review.id,
        work_id: work.id,
        workspace_id: allowed.id,
        target: {
          artifact_id: artifact.id,
          file: 'src/auth.ts',
          side: 'new',
        },
        body: 'legacy add denied',
      },
    },
    { path: `/v1/review-comments/${comment.id}/resolve` },
    { path: `/v1/review-comments/${comment.id}/reopen` },
    {
      path: `/v1/review-comments/${comment.id}/external-id`,
      body: { external_id: 'legacy-denied' },
    },
    {
      path: `/v1/reviews/${review.id}/grill`,
      body: {
        review_id: review.id,
        work_id: work.id,
        workspace_id: allowed.id,
      },
    },
    {
      path: `/v1/grills/${grill.id}/questions`,
      body: { prompt: 'legacy ask denied', severity: 'minor' },
    },
    {
      path: `/v1/grill-questions/${question.id}/answer`,
      body: { answer: 'legacy answer denied' },
    },
    {
      path: `/v1/grill-questions/${question.id}/verdict`,
      body: { verdict: 'accepted' },
    },
    { path: `/v1/grills/${grill.id}/evaluate` },
  ]
  for (const mutation of legacyMutations) {
    const deniedMutation = await containerFetch(authContainer, mutation.path, {
      method: 'POST',
      token: legacyWriter.session_id,
      ...(mutation.body === undefined ? {} : { body: mutation.body }),
    })
    assert(
      deniedMutation.status === 403,
      `legacy workspace writer reached ${mutation.path}`,
    )
  }
  for (const mutation of legacyMutations.filter(
    ({ path }) => !path.endsWith('/answer'),
  )) {
    const deniedMutation = await containerFetch(authContainer, mutation.path, {
      method: 'POST',
      token: session.session_id,
      ...(mutation.body === undefined ? {} : { body: mutation.body }),
    })
    assert(
      deniedMutation.status === 403,
      `review respondent reached collaboration route ${mutation.path}`,
    )
  }

  const reviewerAdminMutations = [
    await containerFetch(authContainer, '/v1/workspaces', {
      method: 'POST',
      token: reviewer.session_id,
      body: {
        name: 'Denied reviewer workspace',
        kind: 'container',
        uri: `docker://reviewer-denied/${runId}`,
      },
    }),
    await containerFetch(authContainer, `/v1/workspaces/${allowed.id}`, {
      method: 'PATCH',
      token: reviewer.session_id,
      body: {
        name: 'Denied reviewer update',
        kind: 'container',
        uri: `docker://allowed/${runId}`,
      },
    }),
    await containerFetch(
      authContainer,
      `/v1/workspaces/${allowed.id}/archive`,
      { method: 'POST', token: reviewer.session_id },
    ),
  ]
  assert(
    reviewerAdminMutations.every((response) => response.status === 403),
    'review collaborator gained workspace administration authority',
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
  const foreignWork = await expectOk(
    strictCli,
    'unbound owner creates foreign work',
    owner.token,
    ['work', 'create', 'Foreign review target', '--workspace', denied.id],
  )
  await expectOk(strictCli, 'unbound owner claims foreign work', owner.token, [
    'work',
    'claim',
    foreignWork.id,
    '--worker',
    owner.worker,
  ])
  await expectOk(strictCli, 'unbound owner starts foreign work', owner.token, [
    'work',
    'update',
    foreignWork.id,
    '--state',
    'running',
  ])
  const foreignReview = await expectOk(
    strictCli,
    'unbound owner requests foreign review',
    owner.token,
    ['review', 'request', '--work', foreignWork.id, '--by', owner.worker],
  )
  const foreignComment = await expectOk(
    strictCli,
    'unbound owner creates foreign comment',
    owner.token,
    [
      'review',
      'comment',
      '--review',
      foreignReview.id,
      '--work',
      foreignWork.id,
      '--workspace',
      denied.id,
      '--artifact',
      artifact.id,
      '--file',
      'src/foreign.ts',
      '--side',
      'new',
      '--body',
      'foreign collaboration target',
    ],
  )
  const foreignGrill = await expectOk(
    strictCli,
    'unbound owner opens foreign grill',
    owner.token,
    [
      'grill',
      'open',
      '--review',
      foreignReview.id,
      '--work',
      foreignWork.id,
      '--workspace',
      denied.id,
    ],
  )
  const foreignQuestion = await expectOk(
    strictCli,
    'unbound owner asks foreign question',
    owner.token,
    [
      'grill',
      'ask',
      foreignGrill.id,
      '--severity',
      'major',
      '--prompt',
      'Should this target be visible?',
    ],
  )
  const opaqueTargets = [
    {
      entity: 'review',
      id: foreignReview.id,
      missing: 'review_missing',
      call: (id) => ({
        path: `/v1/reviews/${id}/grill`,
        body: {
          review_id: id,
          work_id: foreignWork.id,
          workspace_id: denied.id,
        },
      }),
    },
    {
      entity: 'review_comment',
      id: foreignComment.id,
      missing: 'comment_missing',
      call: (id) => ({
        path: `/v1/review-comments/${id}/resolve`,
      }),
    },
    {
      entity: 'grill',
      id: foreignGrill.id,
      missing: 'grill_missing',
      call: (id) => ({
        path: `/v1/grills/${id}/questions`,
        body: { prompt: 'opaque target', severity: 'minor' },
      }),
    },
    {
      entity: 'grill_question',
      id: foreignQuestion.id,
      missing: 'question_missing',
      call: (id) => ({
        path: `/v1/grill-questions/${id}/verdict`,
        body: { verdict: 'accepted' },
      }),
    },
  ]
  for (const target of opaqueTargets) {
    for (const id of [target.id, target.missing]) {
      const mutation = target.call(id)
      const response = await containerFetch(authContainer, mutation.path, {
        method: 'POST',
        token: reviewer.session_id,
        ...(mutation.body === undefined ? {} : { body: mutation.body }),
      })
      assert(
        response.status === 404 &&
          response.body?.error?.details?.value?.entity === target.entity &&
          response.body?.error?.details?.value?.id === id,
        `${target.entity} leaked a missing-versus-foreign distinction`,
      )
    }
  }
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
