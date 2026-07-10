---
type: seam
capacity: EDGE
capacity_score: 2
lifecycle: STABLE
drift_score: 0
drift_status: HEALTHY
production_adapters: 1
change_freq_per_quarter: 1
tags: [seam, edge]
aliases: [GitHub, GitHubGateway]
---

# GitHub (seam)

## Classification

EDGE — ACP's first external-process seam. The domain core and the main server
layer never depend on it; GitHub I/O is composed only into the CLI bridge runner
(`acp gh …`). Its failure degrades only the GitHub bridge, not the protocol host.
The pure-core invariant is enforced by a test
(@root/src/infrastructure/github/pure-core-invariant.test.ts).

## Interface

A GitHub interaction port (`Context.Tag` [[github-gateway|GitHubGateway]]). Pure
interface, no Effect construction leaked; typed `GitHubError` on failure.
Operations: `fetchPullRequest`, `fetchDiff`, `listReviewComments`,
`postReviewComment`, `resolveReviewThread`, `postIssueComment`, `merge`.

## Adapters

| Adapter | Type       | Path                                                   | Last verified | Status  |
| ------- | ---------- | ------------------------------------------------------ | ------------- | ------- |
| gh CLI  | production | @root/src/infrastructure/github/github-gateway-gh.ts   | 2026-07-08    | CURRENT |
| Fake    | test       | @root/src/infrastructure/github/github-gateway-fake.ts | 2026-07-08    | CURRENT |

The real adapter shells out to the `gh` CLI via the confined
[[node-process-io|runProcess]] primitive (argv array, `shell: false`); it relies
on `gh`'s own auth, so ACP never reads, stores, or forwards a GitHub token. The
fake is an in-memory scripted double recording posts/resolves/merges.

## Health

DRIFT 0 (HEALTHY). Both adapters are code-complete and tested: the gh adapter for
argv construction + JSON/GraphQL parsing and non-zero-exit → `GitHubError`; the
fake for post→list reflection and merge/resolve recording. The bridge
([[gh-bridge]]) is proven end-to-end over a live ACP server + fake gateway. An
opt-in Docker lane (`dogfood:docker-gh-sandbox`, see [[gh-bridge]]) additionally
exercises the real `gh` adapter against a disposable PR — import, idempotent
bidirectional sync, and a denied-before-allowed merge — without joining the
offline CI gate, since a live merge needs external authenticated authority.

## Deepening

ADR: [[ADR-0001-architecture-foundation]] (edge isolation). Bridge design binds
ACP's native review gate ([[review-comment-service]] / [[grill-service]]) to real
GitHub PRs.

## Referenced by

[[gh-bridge]] · [[Transport]] · [[architecture/_MOC]]
