/** @Acp.Infra.GitHub.GatewayGh — real gh-CLI adapter */
import { Effect, Layer } from 'effect'
import { runProcess, type ProcessResult } from '../platform-node/index.js'
import { GitHubError } from './github-error.js'
import { GitHubGateway, type GitHubGatewayApi } from './github-gateway.js'
import type {
  GitHubReviewComment,
  MergeMethod,
  PostCommentInput,
  PrRef,
  PullRequestRef,
} from './github-types.js'

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

interface RawReviewComment {
  readonly id: number
  readonly path: string
  readonly line: number | null
  readonly side: 'LEFT' | 'RIGHT'
  readonly body: string
  readonly user: { readonly login: string }
  readonly in_reply_to_id?: number | null
}

const toReviewComment = (raw: RawReviewComment): GitHubReviewComment => ({
  id: String(raw.id),
  path: raw.path,
  line: raw.line,
  side: raw.side,
  body: raw.body,
  author: raw.user.login,
  in_reply_to:
    raw.in_reply_to_id === undefined || raw.in_reply_to_id === null
      ? null
      : String(raw.in_reply_to_id),
  resolved: false,
})

const resolveReviewThreadMutation =
  'mutation($threadId: ID!) { resolveReviewThread(input: { threadId: $threadId }) { thread { id } } }'

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
  listReviewComments: (ref: PrRef) =>
    Effect.map(
      ghJson(run)<readonly RawReviewComment[]>([
        'api',
        `repos/${ref.owner}/${ref.repo}/pulls/${String(ref.number)}/comments`,
      ]),
      (comments) => comments.map(toReviewComment),
    ),
  postReviewComment: (ref: PrRef, input: PostCommentInput) =>
    Effect.map(
      ghJson(run)<RawReviewComment>([
        'api',
        `repos/${ref.owner}/${ref.repo}/pulls/${String(ref.number)}/comments`,
        '-f',
        `body=${input.body}`,
        '-F',
        `line=${input.line === null ? '' : String(input.line)}`,
        '-f',
        `side=${input.side}`,
        '-f',
        `commit_id=${input.commit_id}`,
        '-f',
        `path=${input.path}`,
      ]),
      toReviewComment,
    ),
  resolveReviewThread: (_ref: PrRef, externalId: string) =>
    Effect.asVoid(
      ghText(run)([
        'api',
        'graphql',
        '-f',
        `query=${resolveReviewThreadMutation}`,
        '-F',
        `threadId=${externalId}`,
      ]),
    ),
  postIssueComment: (ref: PrRef, body: string) =>
    Effect.asVoid(
      ghText(run)([
        'pr',
        'comment',
        String(ref.number),
        '--body',
        body,
        ...repoFlag(ref),
      ]),
    ),
})

export const GitHubGatewayGhLive: Layer.Layer<GitHubGateway> = Layer.succeed(
  GitHubGateway,
  makeGhGateway(runProcess),
)
