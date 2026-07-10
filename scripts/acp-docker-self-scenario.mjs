import { runArtifactScenario } from './acp-docker-self-artifact-scenario.mjs'
import { runDomainScenario } from './acp-docker-self-domain-scenario.mjs'
import { assert, expectError, expectOk } from './acp-docker-self-support.mjs'

export const runFeatureScenario = async (cli, runId) => {
  const domain = await runDomainScenario(cli, runId)
  const {
    owner,
    reader,
    workers,
    workspace,
    workspaceList,
    runWork,
    work,
    checkpoint,
  } = domain
  const { artifact } = await runArtifactScenario(cli, domain)

  const review = await expectOk(cli, 'review request', owner.token, [
    'review',
    'request',
    '--work',
    work.id,
    '--by',
    owner.worker,
    '--reviewer',
    owner.worker,
  ])
  const comment = await expectOk(cli, 'review comment', owner.token, [
    'review',
    'comment',
    '--review',
    review.id,
    '--work',
    work.id,
    '--workspace',
    workspace.id,
    '--artifact',
    artifact.id,
    '--file',
    'scripts/acp-docker-self-scenario.mjs',
    '--side',
    'new',
    '--line',
    '1',
    '--body',
    'Prove the full Docker boundary.',
  ])
  const reply = await expectOk(cli, 'review comment reply', owner.token, [
    'review',
    'comment',
    '--review',
    review.id,
    '--work',
    work.id,
    '--workspace',
    workspace.id,
    '--artifact',
    artifact.id,
    '--file',
    'scripts/acp-docker-self-scenario.mjs',
    '--side',
    'new',
    '--body',
    'Covered by live Docker evidence.',
    '--reply-to',
    comment.id,
  ])
  await expectOk(cli, 'review comment resolve', owner.token, [
    'review',
    'comment',
    'resolve',
    comment.id,
  ])
  await expectOk(cli, 'review comment reopen', owner.token, [
    'review',
    'comment',
    'reopen',
    comment.id,
  ])
  await expectOk(cli, 'review comment resolve again', owner.token, [
    'review',
    'comment',
    'resolve',
    comment.id,
  ])
  await expectOk(cli, 'review reply resolve', owner.token, [
    'review',
    'comment',
    'resolve',
    reply.id,
  ])
  const commentsByReview = await expectOk(
    cli,
    'review comment list review',
    reader.token,
    ['review', 'comment', 'list', '--review', review.id],
  )
  const commentsByWork = await expectOk(
    cli,
    'review comment list work',
    reader.token,
    ['review', 'comment', 'list', '--work', work.id],
  )
  assert(
    commentsByReview.length === 2 && commentsByWork.length === 2,
    'review comment lists disagreed',
  )

  const grill = await expectOk(cli, 'grill open', owner.token, [
    'grill',
    'open',
    '--review',
    review.id,
    '--work',
    work.id,
    '--workspace',
    workspace.id,
  ])
  await expectError(
    cli,
    'duplicate grill open',
    owner.token,
    [
      'grill',
      'open',
      '--review',
      review.id,
      '--work',
      work.id,
      '--workspace',
      workspace.id,
    ],
    'invalid_state_transition',
  )
  const question = await expectOk(cli, 'grill ask', owner.token, [
    'grill',
    'ask',
    grill.id,
    '--severity',
    'blocker',
    '--prompt',
    'Why is this safe under restart?',
  ])
  const incomplete = await expectOk(cli, 'grill incomplete', owner.token, [
    'grill',
    'evaluate',
    grill.id,
  ])
  assert(
    incomplete.outcome === 'incomplete',
    'pending grill should be incomplete',
  )
  await expectOk(cli, 'grill answer', owner.token, [
    'grill',
    'answer',
    question.id,
    '--answer',
    'SQLite state is mounted on a named volume and read after restart.',
  ])
  await expectOk(cli, 'grill verdict', owner.token, [
    'grill',
    'verdict',
    question.id,
    '--accept',
  ])
  const grillDetail = await expectOk(cli, 'grill get', reader.token, [
    'grill',
    'get',
    grill.id,
  ])
  const grills = await expectOk(cli, 'grill list', reader.token, [
    'grill',
    'list',
    '--review',
    review.id,
  ])
  assert(
    grillDetail.questions.length === 1 && grills.length === 1,
    'grill read surfaces disagreed',
  )
  const passed = await expectOk(cli, 'grill pass', owner.token, [
    'grill',
    'evaluate',
    grill.id,
  ])
  assert(passed.outcome === 'pass', 'accepted grill did not pass')
  const approved = await expectOk(cli, 'review approve signed', owner.token, [
    'review',
    'approve',
    review.id,
    '--met',
    'docker_build,full_surface,restart_safe',
    '--signature',
    `sig:self:${runId}`,
    '--signature-algorithm',
    'test-v1',
    '--signature-key',
    `docker:${owner.worker}`,
  ])
  assert(approved.state === 'approved', 'review approval did not persist')
  await expectOk(cli, 'work complete', owner.token, [
    'work',
    'update',
    work.id,
    '--state',
    'completed',
  ])

  const changedWork = await runWork(`Request changes ${runId}`)
  const changedReview = await expectOk(
    cli,
    'review request changes target',
    owner.token,
    ['review', 'request', '--work', changedWork.id, '--by', owner.worker],
  )
  const changes = await expectOk(cli, 'review request-changes', owner.token, [
    'review',
    'request-changes',
    changedReview.id,
  ])
  assert(changes.state === 'changes_requested', 'changes request failed')

  const rejectedWork = await runWork(`Reject review ${runId}`)
  const rejectedReview = await expectOk(
    cli,
    'review reject target',
    owner.token,
    ['review', 'request', '--work', rejectedWork.id, '--by', owner.worker],
  )
  const rejected = await expectOk(cli, 'review reject', owner.token, [
    'review',
    'reject',
    rejectedReview.id,
  ])
  assert(rejected.state === 'rejected', 'review reject failed')

  const cancelledWork = await runWork(`Cancel review ${runId}`)
  const cancelledReview = await expectOk(
    cli,
    'review cancel target',
    owner.token,
    ['review', 'request', '--work', cancelledWork.id, '--by', owner.worker],
  )
  const cancelled = await expectOk(cli, 'review cancel', owner.token, [
    'review',
    'cancel',
    cancelledReview.id,
  ])
  assert(cancelled.state === 'cancelled', 'review cancel failed')

  const reviewsForWork = await expectOk(cli, 'review list work', reader.token, [
    'review',
    'list',
    '--work',
    work.id,
  ])
  const reviewsForWorkspace = await expectOk(
    cli,
    'review list workspace',
    reader.token,
    ['review', 'list', '--workspace', workspace.id],
  )
  assert(
    reviewsForWork.length === 1 && reviewsForWorkspace.length === 4,
    'review list surfaces disagreed',
  )

  const resume = await expectOk(cli, 'work resume packet', reader.token, [
    'work',
    'resume',
    work.id,
  ])
  assert(
    resume.work.id === work.id &&
      resume.latest_checkpoint.id === checkpoint.id &&
      resume.artifacts.length === 2 &&
      resume.reviews.length === 1,
    'resume packet omitted durable context',
  )

  // Token-efficiency: a budgeted resume bounds inline artifacts and elides the
  // rest to references, proving the global-workspace shaping end-to-end.
  const budgetedResume = await expectOk(
    cli,
    'work resume budgeted',
    reader.token,
    ['work', 'resume', work.id, '--budget', '1'],
  )
  assert(
    budgetedResume.artifacts.length === 1 &&
      budgetedResume.elided?.artifacts?.count === 1 &&
      budgetedResume.elided.artifacts.ids.length === 1,
    'budgeted resume did not bound artifacts to references',
  )

  const typedEvents = await expectOk(cli, 'events list typed', reader.token, [
    'events',
    'list',
    '--workspace',
    workspace.id,
    '--after',
    '0',
    '--limit',
    '200',
    '--type',
    'review.approved',
  ])
  assert(typedEvents.length === 1, 'typed event replay missed approval')

  const archiveWorkspace = await expectOk(
    cli,
    'workspace create archive target',
    owner.token,
    [
      'workspace',
      'create',
      '--name',
      `Archive target ${runId}`,
      '--kind',
      'container',
      '--uri',
      `docker://archive/${runId}`,
    ],
  )
  const archived = await expectOk(cli, 'workspace archive', owner.token, [
    'workspace',
    'archive',
    archiveWorkspace.id,
  ])
  assert(archived.state === 'archived', 'workspace archive failed')

  return {
    owner,
    workspace,
    work,
    checkpoint,
    artifact,
    review,
    grill,
    counts: {
      workers: workers.length,
      workspaces: workspaceList.length,
      reviews: reviewsForWorkspace.length,
      comments: commentsByReview.length,
      events: typedEvents.length,
    },
  }
}
