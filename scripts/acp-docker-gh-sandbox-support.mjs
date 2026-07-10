/**
 * Support helpers for the opt-in GitHub-bridge sandbox dogfood lane.
 *
 * Two boundaries are enforced here:
 *   - the ACP host runs in Docker and never receives a GitHub token;
 *   - the `acp gh` bridge runs on the HOST via the built CLI and shells out to
 *     the host's authenticated `gh`, so credentials stay owned by `gh`.
 *
 * Every guard fails closed. No function logs a token or `gh auth` output.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { assert, runProcess } from './acp-docker-self-support.mjs'

/** A repo carries this topic to declare itself a throwaway sandbox target. */
export const SENTINEL_TOPIC = 'acp-disposable-sandbox'

/** Host CLI entrypoint the bridge is invoked through. */
export const DIST_MAIN = 'dist/app/cli/main.js'

const REPO_RE = /^[\w.-]+\/[\w.-]+$/
const REF_RE = /^([\w.-]+)\/([\w.-]+)#(\d+)$/

/** Read and validate ACP_GH_SANDBOX_REPO as `owner/repo`; abort otherwise. */
export const requireSandboxRepo = () => {
  const repo = process.env.ACP_GH_SANDBOX_REPO ?? ''
  assert(
    REPO_RE.test(repo),
    'ACP_GH_SANDBOX_REPO must be set to a disposable `owner/repo` (this lane never runs by default)',
  )
  return repo
}

/** Run `gh` and return `{ ok, code, stdout, stderr }`; never echoes input. */
export const gh = (args, options = {}) => runProcess('gh', args, options)

/** Assert `gh` is authenticated without printing any credential material. */
export const requireGhAuth = async () => {
  const result = await gh(['auth', 'status'])
  assert(
    result.ok,
    'gh is not authenticated; run `gh auth login` (credentials stay owned by gh, never by ACP)',
  )
}

/**
 * Verify the target repo carries the sentinel topic. This is the guard that
 * keeps the lane off any production repository even if the env var is wrong.
 */
export const requireDisposableRepo = async (repo) => {
  const result = await gh([
    'repo',
    'view',
    repo,
    '--json',
    'repositoryTopics',
    '--jq',
    '[.repositoryTopics[]? | (.name // .)] | join(",")',
  ])
  assert(result.ok, `cannot read topics for ${repo}: ${result.stderr.trim()}`)
  const topics = result.stdout.trim().split(',').filter(Boolean)
  assert(
    topics.includes(SENTINEL_TOPIC),
    `refusing ${repo}: it must carry the \`${SENTINEL_TOPIC}\` topic to prove it is disposable`,
  )
}

/** Parse `owner/repo#number` into its parts, or fail closed. */
export const parseRef = (ref) => {
  const match = REF_RE.exec(ref)
  assert(match !== null, `malformed PR ref: ${ref}`)
  return { owner: match[1], repo: match[2], number: Number(match[3]) }
}

/** Last line of defense: every gh mutation asserts it targets the sandbox. */
export const assertSandboxRef = (ref, repo) => {
  const parsed = parseRef(ref)
  assert(
    `${parsed.owner}/${parsed.repo}` === repo,
    `refusing to mutate ${ref}: not the sandbox repo ${repo}`,
  )
}

/** Build the current host CLI unless explicit reuse was requested. */
export const ensureHostCli = async ({
  run = runProcess,
  exists = existsSync,
} = {}) => {
  if (process.env.ACP_GH_SANDBOX_SKIP_BUILD === 'true') {
    assert(
      exists(DIST_MAIN),
      `ACP_GH_SANDBOX_SKIP_BUILD=true requires existing ${DIST_MAIN}`,
    )
    return
  }
  const result = await run('node', ['--run', 'build'], {
    timeoutMs: 600_000,
  })
  assert(result.ok, `host build failed: ${result.stderr || result.stdout}`)
  assert(exists(DIST_MAIN), `build did not produce ${DIST_MAIN}`)
}

/**
 * Run an `acp gh <subcommand>` bridge command on the HOST. The bridge talks to
 * the Docker ACP host over the published port and shells to the host `gh`; the
 * GitHub token never enters the container.
 */
export const makeBridge =
  (baseUrl, token) =>
  (args, { expectFailure = false } = {}) =>
    runProcess('node', [DIST_MAIN, 'gh', ...args], {
      env: { ACP_BASE_URL: baseUrl, ACP_RPC_TOKEN: token },
    }).then((result) => {
      if (expectFailure) {
        assert(!result.ok, `acp gh ${args.join(' ')} unexpectedly succeeded`)
      } else {
        assert(
          result.ok,
          `acp gh ${args.join(' ')} failed: ${result.stderr || result.stdout}`,
        )
      }
      return result
    })

const git = (dir, args) =>
  runProcess('git', ['-C', dir, ...args]).then((result) => {
    assert(result.ok, `git ${args.join(' ')} failed: ${result.stderr}`)
    return result.stdout.trim()
  })

/** Find an open sandbox PR for `branch`, returning its number or null. */
export const findOpenSandboxPr = async (repo, branch) => {
  const result = await gh([
    'pr',
    'list',
    '--repo',
    repo,
    '--head',
    branch,
    '--state',
    'open',
    '--json',
    'number',
    '--jq',
    '.[0].number // ""',
  ])
  assert(result.ok, `gh pr list failed: ${result.stderr.trim()}`)
  const value = result.stdout.trim()
  return value === '' ? null : Number(value)
}

/** Write the nested marker that gives the sandbox PR a reviewable diff. */
export const writeSandboxMarker = async (directory, path, runId) => {
  const target = join(directory, path)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(
    target,
    `# ACP sandbox ${runId}\n\nDisposable PR for the GitHub-bridge dogfood lane.\n`,
  )
}

/**
 * Identify or create a disposable PR from `acp-sandbox/<runId>`. The branch adds
 * one file so the diff has a concrete path/line for review comments. Returns
 * `{ ref, number, path, headSha, created }`.
 */
export const identifyOrCreatePr = async (repo, runId) => {
  const branch = `acp-sandbox/${runId}`
  const path = `sandbox/${runId}.md`
  const existing = await findOpenSandboxPr(repo, branch)
  if (existing !== null) {
    const headSha = await prHeadSha(repo, existing)
    return {
      ref: `${repo}#${existing}`,
      number: existing,
      branch,
      path,
      headSha,
      created: false,
    }
  }

  const dir = await mkdtemp(join(tmpdir(), 'acp-gh-sandbox-'))
  try {
    const clone = await gh(['repo', 'clone', repo, dir, '--', '--depth', '1'])
    assert(clone.ok, `gh repo clone failed: ${clone.stderr}`)
    await git(dir, ['checkout', '-b', branch])
    await writeSandboxMarker(dir, path, runId)
    await git(dir, ['add', '-A'])
    await git(dir, [
      '-c',
      'user.email=acp-sandbox@example.invalid',
      '-c',
      'user.name=ACP Sandbox',
      'commit',
      '-m',
      `chore(sandbox): dogfood run ${runId}`,
    ])
    await git(dir, ['push', '-u', 'origin', branch])
    const created = await gh([
      'pr',
      'create',
      '--repo',
      repo,
      '--head',
      branch,
      '--title',
      `ACP sandbox dogfood ${runId}`,
      '--body',
      'Disposable PR created by the ACP GitHub-bridge sandbox lane.',
    ])
    assert(created.ok, `gh pr create failed: ${created.stderr}`)
    const number = await findOpenSandboxPr(repo, branch)
    assert(number !== null, 'created PR but could not resolve its number')
    const headSha = await prHeadSha(repo, number)
    return {
      ref: `${repo}#${number}`,
      number,
      branch,
      path,
      headSha,
      created: true,
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const prHeadSha = async (repo, number) => {
  const result = await gh([
    'pr',
    'view',
    String(number),
    '--repo',
    repo,
    '--json',
    'headRefOid',
    '--jq',
    '.headRefOid',
  ])
  assert(result.ok, `gh pr view failed: ${result.stderr.trim()}`)
  return result.stdout.trim()
}

/** Post a GitHub-side review comment to seed the GitHub -> ACP import path. */
export const seedGithubReviewComment = async (repo, pr, body) => {
  const result = await gh([
    'api',
    `repos/${repo}/pulls/${String(pr.number)}/comments`,
    '-f',
    `body=${body}`,
    '-F',
    'line=1',
    '-f',
    'side=RIGHT',
    '-f',
    `commit_id=${pr.headSha}`,
    '-f',
    `path=${pr.path}`,
  ])
  assert(result.ok, `seeding GitHub review comment failed: ${result.stderr}`)
}

/** Count GitHub review comments on the PR (for idempotency assertions). */
export const countGithubReviewComments = async (repo, number) => {
  const result = await gh([
    'api',
    `repos/${repo}/pulls/${String(number)}/comments`,
    '--jq',
    'length',
  ])
  assert(result.ok, `counting review comments failed: ${result.stderr}`)
  return Number(result.stdout.trim())
}

/** Expected count after seeding GitHub once and mirroring ACP comments once. */
export const expectedFirstSyncCommentCount = (githubBaseline, acpSeedCount) =>
  githubBaseline + acpSeedCount + 1

/** Read the PR's merge state: 'OPEN' | 'MERGED' | 'CLOSED'. */
export const prState = async (repo, number) => {
  const result = await gh([
    'pr',
    'view',
    String(number),
    '--repo',
    repo,
    '--json',
    'state',
    '--jq',
    '.state',
  ])
  assert(result.ok, `gh pr view state failed: ${result.stderr.trim()}`)
  return result.stdout.trim()
}

/** Best-effort cleanup: close the PR and delete its branch. Never throws. */
export const cleanupPr = async (repo, pr) => {
  if (!pr.created) return
  const state = await prState(repo, pr.number).catch(() => 'UNKNOWN')
  if (state === 'OPEN') {
    await gh([
      'pr',
      'close',
      String(pr.number),
      '--repo',
      repo,
      '--delete-branch',
    ]).catch(() => undefined)
    return
  }
  // Merged/closed: the branch may already be gone; delete the ref best-effort.
  await gh([
    'api',
    '-X',
    'DELETE',
    `repos/${repo}/git/refs/heads/${pr.branch}`,
  ]).catch(() => undefined)
}

/** Detached child-process runner with inherited stdio for visible steps. */
export const runVisible = (command, args, env = {}) =>
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
