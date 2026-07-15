import { createHash } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import {
  assert,
  containerFetch,
  docker,
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

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const issuanceAuditAnnotations = (logs) =>
  logs.split('\n').flatMap((line) => {
    const rendered = line.trim()
    if (!rendered.startsWith('{')) return []
    const record = JSON.parse(rendered)
    const annotations = record?.annotations
    return annotations?.security_event === 'session_issuance'
      ? [annotations]
      : []
  })

const issuancePolicy = ({
  workspaceId,
  mainSecret,
  readSecret,
  revision,
  remapSecret,
  issuerId = 'acp-docker-self-static',
}) => ({
  issuer_id: issuerId,
  principals:
    remapSecret === undefined
      ? [
          {
            id: 'principal_docker_main',
            revision,
            enabled: true,
            credential_sha256: sha256(mainSecret),
            worker: {
              id: 'agent_docker_policy_main',
              name: 'Docker policy main',
              kind: 'ci',
              status: 'online',
              capabilities: ['can_run_commands'],
            },
            permissions: ['event:read', 'work:create', 'worker:read'],
            workspace_ids: [workspaceId],
          },
          {
            id: 'principal_docker_read',
            revision,
            enabled: true,
            credential_sha256: sha256(readSecret),
            worker: {
              id: 'agent_docker_policy_read',
              name: 'Docker policy read',
              kind: 'ci',
              status: 'online',
              capabilities: [],
            },
            permissions: ['worker:read'],
            workspace_ids: [workspaceId],
          },
        ]
      : [
          {
            id: 'principal_docker_remap',
            revision,
            enabled: true,
            credential_sha256: sha256(remapSecret),
            worker: {
              id: 'agent_docker_policy_main',
              name: 'Illegal remap',
              kind: 'ci',
              status: 'online',
              capabilities: ['can_run_commands'],
            },
            permissions: ['worker:read'],
            workspace_ids: [workspaceId],
          },
        ],
})

const hostileInitialize = (runId, workspaceId) => ({
  worker: {
    id: `agent_hostile_${runId}`,
    name: 'Hostile caller',
    kind: 'agent',
  },
  capabilities: { can_create_prs: true },
  permissions: ['review:approve'],
  workspace_ids: [workspaceId],
})

const websocketRpc = async ({ container, path, token = '', request }) => {
  const script = `
import { createRequire } from 'node:module'
const [path, token, rawRequest] = process.argv.slice(1)
const rootRequire = createRequire(import.meta.url)
const platformRequire = createRequire(rootRequire.resolve('@effect/platform-node/package.json'))
const WebSocket = platformRequire('ws')
const socket = new WebSocket('ws://127.0.0.1:4317' + path, {
  ...(token === '' ? {} : { headers: { authorization: 'Bearer ' + token } }),
})
const timeout = setTimeout(() => { console.error('websocket timeout'); process.exit(1) }, 10000)
socket.addEventListener('open', () => socket.send(rawRequest))
socket.addEventListener('message', (event) => {
  clearTimeout(timeout)
  console.log(String(event.data))
  socket.close()
})
socket.addEventListener('error', () => { console.error('websocket error'); process.exit(1) })
`
  const output = await dockerOk([
    'exec',
    container,
    'node',
    '--input-type=module',
    '-e',
    script,
    path,
    token,
    JSON.stringify(request),
  ])
  return JSON.parse(output)
}

const nativeInitialize = async ({ container, token, payload }) => {
  const script = `
import { Effect, Schema } from 'effect'
import { InitializeSessionPayload } from './dist/infrastructure/http/index.js'
import {
  acpRpcClientHostLayer, makeAcpRpcClient, withAcpRpcBearer
} from './dist/infrastructure/rpc/index.js'
const [token, rawPayload] = process.argv.slice(1)
const result = await Effect.runPromise(
  Effect.gen(function* () {
    const client = yield* makeAcpRpcClient
    const payload = yield* Schema.decodeUnknown(InitializeSessionPayload)(JSON.parse(rawPayload))
    return yield* withAcpRpcBearer(token)(client.session.initialize(payload))
  }).pipe(
    Effect.provide(acpRpcClientHostLayer('http://127.0.0.1:4317')),
    Effect.scoped,
  ),
)
console.log(JSON.stringify(result))
`
  const output = await dockerOk([
    'exec',
    container,
    'node',
    '--input-type=module',
    '-e',
    script,
    token,
    JSON.stringify(payload),
  ])
  return JSON.parse(output)
}

const nativeForeignWorkspace = async ({ container, token, workspaceId }) => {
  const script = `
import { Effect, Schema } from 'effect'
import { CreateWorkPayload } from './dist/protocol/schema/index.js'
import {
  acpRpcClientHostLayer, makeAcpRpcClient, withAcpRpcBearer
} from './dist/infrastructure/rpc/index.js'
const [token, workspaceId] = process.argv.slice(1)
const result = await Effect.runPromise(
  Effect.gen(function* () {
    const client = yield* makeAcpRpcClient
    const payload = yield* Schema.decodeUnknown(CreateWorkPayload)({
      workspace_id: workspaceId,
      title: 'Denied native cross-workspace work',
    })
    return yield* Effect.either(
      withAcpRpcBearer(token)(client.work.create(payload)),
    )
  }).pipe(
    Effect.provide(acpRpcClientHostLayer('http://127.0.0.1:4317')),
    Effect.scoped,
  ),
)
console.log(JSON.stringify(
  result._tag === 'Left'
    ? { tag: result._tag, code: result.left.error.code }
    : { tag: result._tag },
))
`
  const output = await dockerOk([
    'exec',
    container,
    'node',
    '--input-type=module',
    '-e',
    script,
    token,
    workspaceId,
  ])
  return JSON.parse(output)
}

export const proveTrustedIssuance = async ({
  image,
  authContainer,
  authVolume,
  runId,
}) => {
  const mainSecret = `issuance-main-${runId}`
  const readSecret = `issuance-read-${runId}`
  const remapSecret = `issuance-remap-${runId}`
  const allowedWorkspace = `workspace_static_${runId}`
  const hostileWorkspace = `workspace_hostile_${runId}`
  let auditLogs = ''

  const captureLogs = async () => {
    const logs = await docker(['logs', authContainer])
    if (logs.ok) auditLogs += `${logs.stdout}\n${logs.stderr}\n`
  }
  const startStatic = async (policy) => {
    await captureLogs()
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
      'ACP_SESSION_ISSUER=static',
      '-e',
      `ACP_SESSION_ISSUANCE_POLICY=${JSON.stringify(policy)}`,
      '-e',
      'ACP_STORAGE_ADAPTER=sqlite',
      '-e',
      'ACP_SQLITE_PATH=/data/acp.sqlite',
      '-v',
      `${authVolume}:/data`,
      image,
    ])
    await waitForReady(authContainer)
  }

  await startStatic(
    issuancePolicy({
      workspaceId: allowedWorkspace,
      mainSecret,
      readSecret,
      revision: '1',
    }),
  )
  const request = hostileInitialize(runId, hostileWorkspace)
  const missing = await containerFetch(
    authContainer,
    '/v1/session/initialize',
    { method: 'POST', body: request },
  )
  const wrong = await containerFetch(authContainer, '/v1/session/initialize', {
    method: 'POST',
    token: 'wrong-issuance-secret',
    body: request,
  })
  assert(
    missing.status === 401 &&
      wrong.status === 401 &&
      JSON.stringify(missing.body) === JSON.stringify(wrong.body),
    'static issuance did not deny missing/wrong credentials identically',
  )

  const cli = makeCli(authContainer)
  const main = await expectOk(cli, 'static CLI issuance', mainSecret, [
    'session',
    'init',
    '--worker',
    `agent_hostile_cli_${runId}`,
    '--name',
    'Hostile CLI caller',
    '--permissions',
    'review:approve',
    '--workspace',
    hostileWorkspace,
  ])
  assert(
    JSON.stringify(main.permissions) ===
      JSON.stringify(['event:read', 'work:create', 'worker:read']) &&
      JSON.stringify(main.workspace_ids) === JSON.stringify([allowedWorkspace]),
    'static CLI issuance retained hostile authority',
  )
  const workers = await expectOk(
    cli,
    'static worker attribution',
    main.session_id,
    ['worker', 'list'],
  )
  assert(
    workers.some((worker) => worker.id === 'agent_docker_policy_main') &&
      workers.every((worker) => worker.id !== `agent_hostile_cli_${runId}`),
    'static issuance registered the hostile worker',
  )

  const jsonRpc = await containerFetch(authContainer, '/rpc', {
    method: 'POST',
    token: mainSecret,
    body: {
      jsonrpc: '2.0',
      id: 'static-jsonrpc-http',
      method: 'session.initialize',
      params: request,
    },
  })
  assert(
    jsonRpc.body?.result?.permissions?.includes('worker:read') &&
      !jsonRpc.body?.result?.permissions?.includes('review:approve'),
    'JSON-RPC HTTP did not use static issuance',
  )
  const stdio = await stdioRpc(
    authContainer,
    {
      jsonrpc: '2.0',
      id: 'static-stdio',
      method: 'session.initialize',
      params: request,
    },
    mainSecret,
  )
  assert(
    stdio.result?.permissions?.includes('worker:read') &&
      !stdio.result?.permissions?.includes('review:approve'),
    'stdio did not use static issuance',
  )
  const websocket = await websocketRpc({
    container: authContainer,
    path: '/rpc',
    token: mainSecret,
    request: {
      jsonrpc: '2.0',
      id: 'static-websocket-header',
      method: 'session.initialize',
      params: request,
    },
  })
  assert(
    websocket.result?.permissions?.includes('worker:read'),
    'WebSocket header did not use static issuance',
  )
  const queryDenied = await websocketRpc({
    container: authContainer,
    path: `/rpc?token=${encodeURIComponent(mainSecret)}`,
    request: {
      jsonrpc: '2.0',
      id: 'static-websocket-query',
      method: 'session.initialize',
      params: request,
    },
  })
  assert(
    queryDenied.error?.data?.error?.code === 'unauthorized',
    'WebSocket query credential initialized a static session',
  )
  const native = await nativeInitialize({
    container: authContainer,
    token: mainSecret,
    payload: request,
  })
  assert(
    native.permissions?.includes('worker:read') &&
      !native.permissions?.includes('review:approve'),
    'native RPC did not use static issuance',
  )
  const nativeForeign = await nativeForeignWorkspace({
    container: authContainer,
    token: native.session_id,
    workspaceId: hostileWorkspace,
  })
  assert(
    nativeForeign.tag === 'Left' && nativeForeign.code === 'forbidden',
    'native RPC bypassed the static session workspace binding',
  )

  const readOnly = await expectOk(
    cli,
    'static read-only issuance',
    readSecret,
    [
      'session',
      'init',
      '--worker',
      `agent_hostile_read_${runId}`,
      '--name',
      'Hostile read caller',
      '--permissions',
      'event:read',
      '--workspace',
      hostileWorkspace,
    ],
  )
  const subscribe = (path, id) =>
    websocketRpc({
      container: authContainer,
      path,
      request: {
        jsonrpc: '2.0',
        id,
        method: 'events.subscribe',
        params: { workspace_id: allowedWorkspace },
      },
    })
  const noToken = await subscribe('/rpc', 'static-subscribe-no-token')
  const noScope = await subscribe(
    `/rpc?token=${readOnly.session_id}`,
    'static-subscribe-no-scope',
  )
  const foreign = await websocketRpc({
    container: authContainer,
    path: `/rpc?token=${main.session_id}`,
    request: {
      jsonrpc: '2.0',
      id: 'static-subscribe-foreign',
      method: 'events.subscribe',
      params: { workspace_id: hostileWorkspace },
    },
  })
  const allowed = await subscribe(
    `/rpc?token=${main.session_id}`,
    'static-subscribe-allowed',
  )
  assert(
    noToken.error?.data?.error?.code === 'unauthorized' &&
      noScope.error?.data?.error?.code === 'forbidden' &&
      foreign.error?.data?.error?.code === 'forbidden' &&
      allowed.result?.subscribed === true,
    'WebSocket subscription authorization did not fail closed',
  )

  const oldSession = main.session_id
  await startStatic(
    issuancePolicy({
      workspaceId: allowedWorkspace,
      mainSecret,
      readSecret,
      revision: '2',
    }),
  )
  const revoked = await containerFetch(authContainer, '/v1/workers', {
    token: oldSession,
  })
  assert(revoked.status === 401, 'policy revision did not revoke old session')
  const revisedCli = makeCli(authContainer)
  const revised = await expectOk(
    revisedCli,
    'revised static issuance',
    mainSecret,
    [
      'session',
      'init',
      '--worker',
      `agent_hostile_revised_${runId}`,
      '--name',
      'Hostile revised caller',
      '--workspace',
      hostileWorkspace,
    ],
  )
  assert(
    revised.session_id !== oldSession,
    'revised policy did not mint a fresh session',
  )

  await startStatic(
    issuancePolicy({
      workspaceId: allowedWorkspace,
      mainSecret,
      readSecret,
      revision: '3',
      remapSecret,
      issuerId: 'acp-docker-self-static-remap',
    }),
  )
  const remap = await containerFetch(authContainer, '/v1/session/initialize', {
    method: 'POST',
    token: remapSecret,
    body: request,
  })
  assert(
    remap.status === 401,
    'historical principal/worker attribution was remapped',
  )
  await captureLogs()
  const forbiddenValues = [
    mainSecret,
    readSecret,
    remapSecret,
    sha256(mainSecret),
    sha256(readSecret),
    sha256(remapSecret),
    oldSession,
    revised.session_id,
  ]
  const auditEvents = issuanceAuditAnnotations(auditLogs)
  const leakedValueIndexes = forbiddenValues.flatMap((value, index) =>
    auditLogs.includes(value) ? [index] : [],
  )
  const auditSummary = JSON.stringify({
    event_count: auditEvents.length,
    decisions: [...new Set(auditEvents.map((event) => event.decision))].sort(),
    principal_ids: [
      ...new Set(
        auditEvents.map((event) => event.principal_id).filter(Boolean),
      ),
    ].sort(),
    leaked_value_indexes: leakedValueIndexes,
  })
  assert(
    auditEvents.some(
      (event) =>
        event.decision === 'accepted' &&
        event.principal_id === 'principal_docker_main',
    ) &&
      auditEvents.some(
        (event) =>
          event.decision === 'revoked' &&
          event.principal_id === 'principal_docker_main',
      ) &&
      leakedValueIndexes.length === 0,
    `static issuance audit was incomplete or leaked credentials: ${auditSummary}`,
  )
}
