---
type: module
path: '@root/src/infrastructure/github/github-gateway-fake.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[GitHub]]'
depth_score: 0.4
depth_status: MEDIUM
tags: [module, test-double]
aliases: [github-gateway-fake, makeGitHubGatewayFake]
---

# GitHubGateway (fake)

## Purpose

An in-memory scripted [[GitHub]] adapter for tests, so the whole [[gh-bridge]] can
run over a live ACP server with no `gh` subprocess.

## Interface

### Signatures

```typescript
export interface FakeSeed {
  pull: PullRequestRef
  diff: string
  comments: GitHubReviewComment[]
}
export interface FakeState {
  postedComments: unknown[]
  resolvedThreads: unknown[]
  issueComments: unknown[]
  merged: unknown[]
}
export const makeGitHubGatewayFake: (seed: FakeSeed) => {
  layer: Layer<GitHubGateway>
  state: FakeState
}
```

### Linkage

- **Requires:** [[github-gateway]], [[github-types]].
- **Consumed by:** the gh bridge tests ([[gh-bridge]], gh import/sync/merge specs).

## Algorithm

Serves `fetchPullRequest`/`fetchDiff`/`listReviewComments` from a working copy of
`seed`. `postReviewComment` assigns a deterministic id `gh_c_<n>` and appends the
comment to both `state.postedComments` and the served list, so a later
`listReviewComments` reflects it. `resolveReviewThread`/`postIssueComment`/`merge`
record onto `state` (`{ ref, method }` for merges). Every effect succeeds.

## Negative Logic

Never fails and never spawns a process — it is deliberately a happy-path double;
error-channel behavior is exercised only against [[github-gateway-gh]].

## Grill Log

- **Q (major):** Why append posted comments to the served list? **A:** so
  idempotency and loop-guard tests can observe that a re-run does not re-post —
  the second `listReviewComments` already contains the first post.
