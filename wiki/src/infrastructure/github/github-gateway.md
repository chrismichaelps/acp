---
type: module
path: '@root/src/infrastructure/github/github-gateway.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[GitHub]]'
depth_score: 0.5
depth_status: MEDIUM
tags: [module, medium]
aliases: [github-gateway, GitHubGateway, GitHubGatewayApi]
---

# GitHubGateway

## Purpose

Declare the [[GitHub]] interaction seam as a `Context.Tag`, so the CLI bridge
depends on an abstract GitHub port rather than the `gh` process. Real adapter is
[[github-gateway-gh]]; test double is [[github-gateway-fake]].

## Interface

### Signatures

```typescript
export interface GitHubGatewayApi {
  readonly fetchPullRequest: (ref: PrRef) => Effect<PullRequestRef, GitHubError>
  readonly fetchDiff: (ref: PrRef) => Effect<string, GitHubError>
  readonly listReviewComments: (ref: PrRef) => Effect<readonly GitHubReviewComment[], GitHubError>
  readonly postReviewComment: (ref: PrRef, input: PostCommentInput) => Effect<GitHubReviewComment, GitHubError>
  readonly resolveReviewThread: (ref: PrRef, externalId: string) => Effect<void, GitHubError>
  readonly postIssueComment: (ref: PrRef, body: string) => Effect<void, GitHubError>
  readonly merge: (ref: PrRef, method: MergeMethod) => Effect<void, GitHubError>
}
export class GitHubGateway extends Context.Tag('GitHubGateway')<GitHubGateway, GitHubGatewayApi>() {}
```

Value shapes (`PrRef`, `PullRequestRef`, `GitHubReviewComment`, `PostCommentInput`,
`MergeMethod`) and `parsePrRef` (URL or `owner/repo#n` → `Either<PrRef, GitHubError>`)
live in [[github-types]]; `GitHubError` in [[github-error]].

### Linkage

- **Requires:** `effect` `Context`/`Effect`, [[github-types]], [[github-error]].
- **Consumed by:** [[gh-bridge]] (via `yield* GitHubGateway`), provided by
  `GitHubGatewayGhLive` in production and `makeGitHubGatewayFake` in tests.

## Algorithm

None — a pure interface declaration. Behavior lives in the adapters.

## Negative Logic

The domain core and main server layer must NOT import this module (enforced by
[[pure-core-invariant|the pure-core invariant test]]). All methods fail through
the typed `GitHubError` channel; adapters never throw.

## Grill Log

- **Q (blocker):** Why a `Context.Tag` rather than importing the `gh` adapter
  directly in the bridge? **A:** to keep GitHub I/O swappable and testable — the
  fake adapter drives the whole bridge over a live ACP server with no subprocess,
  and the seam keeps the `gh` dependency out of the composition root.
- **Q (major):** Why does `merge` take a `MergeMethod` rather than defaulting?
  **A:** the merge method is a caller decision (`--method`); the gateway stays
  mechanism, the bridge owns policy.
