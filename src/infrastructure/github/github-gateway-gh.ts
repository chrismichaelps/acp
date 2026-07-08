/** @Acp.Infra.GitHub.GatewayGh — real gh-CLI adapter */
import { Effect, Layer } from 'effect'
import { runProcess, type ProcessResult } from '../platform-node/index.js'
import { GitHubError } from './github-error.js'
import { GitHubGateway, type GitHubGatewayApi } from './github-gateway.js'
import type { MergeMethod, PrRef, PullRequestRef } from './github-types.js'

export type RunProcess = (
  command: string,
  args: readonly string[],
  options?: { readonly input?: string },
) => Effect.Effect<ProcessResult>

const repoFlag = (ref: PrRef) => ['--repo', `${ref.owner}/${ref.repo}`]

const ghText = (run: RunProcess) => (args: readonly string[], input?: string) =>
  Effect.flatMap(run('gh', args, input === undefined ? {} : { input }), (r) =>
    r.code === 0
      ? Effect.succeed(r.stdout)
      : Effect.fail(
          new GitHubError({
            command: `gh ${args.join(' ')}`,
            stderr: r.stderr,
          }),
        ),
  )

const ghJson =
  (run: RunProcess) =>
  <T>(args: readonly string[]) =>
    Effect.flatMap(ghText(run)(args), (text) =>
      Effect.try({
        try: () => JSON.parse(text) as T,
        catch: () =>
          new GitHubError({
            command: `gh ${args.join(' ')}`,
            stderr: `bad JSON: ${text}`,
          }),
      }),
    )

export const makeGhGateway = (run: RunProcess): GitHubGatewayApi => ({
  fetchPullRequest: (ref) =>
    Effect.map(
      ghJson(run)<{
        number: number
        url: string
        headRefOid: string
        baseRefOid: string
        state: string
        mergeable: string
        title: string
      }>([
        'pr',
        'view',
        String(ref.number),
        ...repoFlag(ref),
        '--json',
        'number,url,headRefOid,baseRefOid,state,mergeable,title',
      ]),
      (j): PullRequestRef => ({
        number: j.number,
        url: j.url,
        head_sha: j.headRefOid,
        base_sha: j.baseRefOid,
        state: j.state,
        mergeable: j.mergeable === 'MERGEABLE',
        title: j.title,
      }),
    ),
  fetchDiff: (ref) =>
    ghText(run)(['pr', 'diff', String(ref.number), ...repoFlag(ref)]),
  merge: (ref: PrRef, method: MergeMethod) =>
    Effect.asVoid(
      ghText(run)([
        'pr',
        'merge',
        String(ref.number),
        `--${method}`,
        ...repoFlag(ref),
      ]),
    ),
  listReviewComments: () => Effect.die('not implemented until Task 5'),
  postReviewComment: () => Effect.die('not implemented until Task 5'),
  resolveReviewThread: () => Effect.die('not implemented until Task 5'),
  postIssueComment: () => Effect.die('not implemented until Task 5'),
})

export const GitHubGatewayGhLive: Layer.Layer<GitHubGateway> = Layer.succeed(
  GitHubGateway,
  makeGhGateway(runProcess),
)
