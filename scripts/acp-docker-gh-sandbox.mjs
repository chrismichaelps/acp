#!/usr/bin/env node
/**
 * Opt-in GitHub-bridge sandbox dogfood lane (refs #268).
 *
 * Exercises `acp gh import`, `sync`, and `merge` end-to-end through Docker
 * against a DISPOSABLE, authenticated GitHub repository. This lane is NOT part
 * of the offline `dogfood:docker-self` CI gate: it mutates an external pull
 * request and needs authenticated merge authority.
 *
 * Boundaries:
 *   - the ACP host runs in Docker and never receives a GitHub token;
 *   - the `acp gh` bridge runs on the host and shells to the host's `gh`;
 *   - it refuses any repo not tagged `acp-disposable-sandbox`;
 *   - a blocked merge is proven before an allowed merge, only in the sandbox.
 *
 * Prerequisites and cleanup are documented in wiki/src/app/cli/gh-bridge.md.
 *   ACP_GH_SANDBOX_REPO=owner/repo   (required; must carry the sentinel topic)
 *   ACP_GH_SANDBOX_KEEP=true         (optional; retain PR, branch, and stack)
 *   ACP_GH_SANDBOX_SKIP_BUILD=true   (optional; reuse existing host dist)
 */
import process from 'node:process'
import {
  allPermissions,
  assert,
  docker,
  dockerOk,
  expectOk,
  initAgent,
  makeCli,
  waitForReady,
} from './acp-docker-self-support.mjs'
import {
  assertSandboxRef,
  cleanupPr,
  countGithubReviewComments,
  ensureHostCli,
  expectedFirstSyncCommentCount,
  identifyOrCreatePr,
  makeBridge,
  prState,
  requireDisposableRepo,
  requireGhAuth,
  requireSandboxRepo,
  runVisible,
  seedGithubReviewComment,
} from './acp-docker-gh-sandbox-support.mjs'

const runId = process.env.ACP_DOGFOOD_RUN_ID ?? Date.now().toString(36)
const keep = process.env.ACP_GH_SANDBOX_KEEP === 'true'
const skipBuild = process.env.ACP_DOCKER_SKIP_BUILD === 'true'
const image = process.env.ACP_DOCKER_IMAGE ?? 'acp:latest'
const container = `acp-gh-sandbox-${runId}`
const volume = `${container}-data`
const baseUrl = 'http://127.0.0.1:4317'

const teardownStack = async () => {
  await docker(['rm', '-f', container]).catch(() => undefined)
  await docker(['volume', 'rm', volume]).catch(() => undefined)
}

const startStack = async () => {
  if (!skipBuild) await runVisible('docker', ['build', '-t', image, '.'])
  await dockerOk(['volume', 'create', volume])
  await dockerOk([
    'run',
    '-d',
    '--name',
    container,
    '-p',
    '4317:4317',
    '-e',
    'ACP_STORAGE_ADAPTER=sqlite',
    '-e',
    'ACP_SQLITE_PATH=/data/acp.sqlite',
    '-v',
    `${volume}:/data`,
    image,
  ])
  await waitForReady(container)
}

// Seed the ACP-side state a real bridge run reconciles against, ending with an
// unstamped ACP-origin review comment on the PR's file so `sync` has work to do.
const seedAcpState = async (cli, pr) => {
  const planner = await initAgent(cli, 'planner', runId, allPermissions)
  const worker = await initAgent(cli, 'worker', runId, allPermissions)
  const reviewer = await initAgent(cli, 'reviewer', runId, allPermissions)

  const workspace = await expectOk(cli, 'workspace create', planner.token, [
    'workspace',
    'create',
    '--name',
    `sandbox ${runId}`,
    '--kind',
    'git_repository',
    '--uri',
    `git+https://github.com/${requireSandboxRepo()}.git`,
    '--default-branch',
    'main',
  ])
  const work = await expectOk(cli, 'work create', planner.token, [
    'work',
    'create',
    `Sandbox merge target ${runId}`,
    '--workspace',
    workspace.id,
  ])
  await expectOk(cli, 'work claim', worker.token, [
    'work',
    'claim',
    work.id,
    '--worker',
    worker.worker,
  ])
  await expectOk(cli, 'work running', worker.token, [
    'work',
    'update',
    work.id,
    '--state',
    'running',
  ])
  const artifact = await expectOk(cli, 'artifact create', planner.token, [
    'artifact',
    'create',
    '--workspace',
    workspace.id,
    '--work',
    work.id,
    '--kind',
    'markdown',
    '--summary',
    'sandbox seed',
    '--content',
    'seed',
  ])
  const review = await expectOk(cli, 'review request', worker.token, [
    'review',
    'request',
    '--work',
    work.id,
    '--by',
    worker.worker,
    '--reviewer',
    reviewer.worker,
  ])
  await expectOk(cli, 'acp-origin review comment', reviewer.token, [
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
    pr.path,
    '--side',
    'new',
    '--line',
    '1',
    '--body',
    'ACP-origin comment mirrored to GitHub by the bridge.',
  ])
  return { planner, worker, reviewer, workspace, work, artifact, review }
}

const countAcpComments = async (cli, token, workId) => {
  const comments = await expectOk(cli, 'review comment list', token, [
    'review',
    'comment',
    'list',
    '--work',
    workId,
  ])
  return comments
}

const resolveOpenComments = async (cli, token, workId) => {
  const comments = await countAcpComments(cli, token, workId)
  for (const comment of comments) {
    if (comment.state !== 'resolved') {
      await expectOk(cli, 'review comment resolve', token, [
        'review',
        'comment',
        'resolve',
        comment.id,
      ])
    }
  }
}

// Drive one grill round to a pass so the merge gate's grill condition is met.
const passGrill = async (cli, seed) => {
  const { reviewer, worker, review, work, workspace } = seed
  const grill = await expectOk(cli, 'grill open', reviewer.token, [
    'grill',
    'open',
    '--review',
    review.id,
    '--work',
    work.id,
    '--workspace',
    workspace.id,
  ])
  const question = await expectOk(cli, 'grill ask', reviewer.token, [
    'grill',
    'ask',
    grill.id,
    '--severity',
    'blocker',
    '--prompt',
    'Is the sandbox merge safe?',
  ])
  await expectOk(cli, 'grill answer', worker.token, [
    'grill',
    'answer',
    question.id,
    '--answer',
    'Yes; the target repo is disposable and guarded by the sentinel topic.',
  ])
  await expectOk(cli, 'grill verdict', reviewer.token, [
    'grill',
    'verdict',
    question.id,
    '--accept',
  ])
  const evaluation = await expectOk(cli, 'grill evaluate', reviewer.token, [
    'grill',
    'evaluate',
    grill.id,
  ])
  assert(evaluation.outcome === 'pass', 'grill did not pass after acceptance')
}

const main = async () => {
  // Preflight guards — fail closed before touching Docker or GitHub.
  const repo = requireSandboxRepo()
  await requireGhAuth()
  await requireDisposableRepo(repo)
  await ensureHostCli()

  await teardownStack()
  let pr
  try {
    await startStack()
    const cli = makeCli(container)

    // Identify or create the disposable PR, then seed matching ACP state.
    pr = await identifyOrCreatePr(repo, runId)
    assertSandboxRef(pr.ref, repo)
    const seed = await seedAcpState(cli, pr)
    const bridge = makeBridge(baseUrl, seed.planner.token)

    // 1) import: PR diff + metadata become ACP artifacts.
    await bridge([
      'import',
      pr.ref,
      '--work',
      seed.work.id,
      '--workspace',
      seed.workspace.id,
    ])
    const artifacts = await expectOk(cli, 'artifact list', seed.planner.token, [
      'artifact',
      'list',
      '--work',
      seed.work.id,
    ])
    const kinds = new Set(artifacts.map((a) => a.kind))
    assert(
      kinds.has('diff') && kinds.has('pull_request'),
      'import did not create PR artifacts',
    )

    // 2) sync (bidirectional) is idempotent across repeated runs.
    const ghBeforeFirst = await countGithubReviewComments(repo, pr.number)
    const acpBeforeFirst = (
      await countAcpComments(cli, seed.planner.token, seed.work.id)
    ).length
    assert(
      acpBeforeFirst === 1,
      `expected 1 seeded ACP comment before sync, got ${String(acpBeforeFirst)}`,
    )
    await seedGithubReviewComment(
      repo,
      pr,
      'GitHub-origin note for the bridge.',
    )
    const syncArgs = [
      'sync',
      pr.ref,
      '--work',
      seed.work.id,
      '--review',
      seed.review.id,
      '--artifact',
      seed.artifact.id,
    ]
    await bridge(syncArgs)
    const ghAfterFirst = await countGithubReviewComments(repo, pr.number)
    const acpAfterFirst = (
      await countAcpComments(cli, seed.planner.token, seed.work.id)
    ).length
    const expectedAfterFirst = expectedFirstSyncCommentCount(
      ghBeforeFirst,
      acpBeforeFirst,
    )
    assert(
      ghAfterFirst === expectedAfterFirst,
      `expected ${String(expectedAfterFirst)} GitHub comments after sync, got ${String(ghAfterFirst)}`,
    )
    assert(
      acpAfterFirst === expectedAfterFirst,
      `expected ${String(expectedAfterFirst)} ACP comments after sync, got ${String(acpAfterFirst)}`,
    )

    await bridge(syncArgs)
    const ghAfterSecond = await countGithubReviewComments(repo, pr.number)
    const acpAfterSecond = (
      await countAcpComments(cli, seed.planner.token, seed.work.id)
    ).length
    assert(
      ghAfterSecond === ghAfterFirst,
      `sync not idempotent on GitHub: ${String(ghAfterFirst)} -> ${String(ghAfterSecond)}`,
    )
    assert(
      acpAfterSecond === acpAfterFirst,
      `sync not idempotent in ACP: ${String(acpAfterFirst)} -> ${String(acpAfterSecond)}`,
    )

    // 3) merge is blocked while the gate is red; gh merge is never called.
    await bridge(['merge', pr.ref, '--work', seed.work.id], {
      expectFailure: true,
    })
    const blockedState = await prState(repo, pr.number)
    assert(blockedState === 'OPEN', `blocked merge left PR in ${blockedState}`)

    // 4) satisfy the gate (resolve comments, pass grill, approve), then merge.
    await passGrill(cli, seed)
    await resolveOpenComments(cli, seed.reviewer.token, seed.work.id)
    await expectOk(cli, 'review approve', seed.reviewer.token, [
      'review',
      'approve',
      seed.review.id,
      '--met',
      'sandbox_dogfood',
    ])
    await bridge(['merge', pr.ref, '--work', seed.work.id])
    const mergedState = await prState(repo, pr.number)
    assert(mergedState === 'MERGED', `allowed merge left PR in ${mergedState}`)

    console.log(
      JSON.stringify(
        {
          ok: true,
          run_id: runId,
          repo,
          pr: pr.number,
          proved: [
            'import-artifacts',
            'sync-bidirectional-idempotent',
            'merge-denied-before-allowed',
            'merge-in-sandbox-only',
          ],
        },
        null,
        2,
      ),
    )
  } finally {
    if (!keep) {
      await teardownStack()
      if (pr) await cleanupPr(repo, pr)
    } else {
      console.log(
        `ACP_GH_SANDBOX_KEEP=true — retained stack ${container} and PR ${pr?.number ?? '(none)'}`,
      )
    }
  }
}

await main()
