---
type: seam
capacity: EXPLORATORY
capacity_score: 2
lifecycle: EXPLORATORY
drift_score: 0
drift_status: HEALTHY
production_adapters: 1
change_freq_per_quarter: 1
tags: [seam, exploratory]
aliases: [GitHub, GitHubGateway]
---

# GitHub (seam)

## Classification

EXPLORATORY (edge-isolated) — one production adapter (`gh`) serves an optional
integration whose failure degrades only the CLI bridge, not the protocol host.
The domain core and the main server layer never depend on it; GitHub I/O is
composed only into the CLI bridge runner (`acp gh …`). The pure-core invariant is
enforced by a test
(@root/src/infrastructure/github/pure-core-invariant.test.ts).

## Interface

A GitHub interaction port (`Context.Tag` [[github-gateway|GitHubGateway]]). Pure
interface, no Effect construction leaked; typed `GitHubError` on failure.
Operations: `fetchPullRequest`, `fetchDiff`, `listReviewComments`,
`postReviewComment`, `resolveReviewThread`, `postIssueComment`, `merge`.

## Adapters

| Adapter | Type       | Path                                                   | Last verified | Status  |
| ------- | ---------- | ------------------------------------------------------ | ------------- | ------- |
| gh CLI  | production | @root/src/infrastructure/github/github-gateway-gh.ts   | 2026-07-10    | CURRENT |
| Fake    | test       | @root/src/infrastructure/github/github-gateway-fake.ts | 2026-07-08    | CURRENT |

The real adapter shells out to the `gh` CLI via the confined
[[node-process-io|runProcess]] primitive (argv array, `shell: false`); it relies
on `gh`'s own auth, so ACP never reads, stores, or forwards a GitHub token. The
fake is an in-memory scripted double recording posts/resolves/merges.

## Health

DRIFT 0 (HEALTHY). Both adapters are code-complete and tested: the gh adapter for
argv construction + JSON/GraphQL parsing and non-zero-exit → `GitHubError`; the
fake for post→list reflection and merge/resolve recording. The bridge
([[gh-bridge]]) is proven end-to-end over a live ACP server + fake gateway. The
opt-in Docker lane (`dogfood:docker-gh-sandbox`, see [[gh-bridge]]) is designed to
exercise the real `gh` adapter against a disposable PR — import, idempotent
bidirectional sync, and a denied-before-allowed merge — without joining the
offline CI gate, since a live merge needs external authenticated authority. Its
offline and live gates are green. Sandbox PR #3 records a denied decision
(`requested`, no grill, 2 unresolved) followed by an allowed decision (`approved`,
grill passed, 0 unresolved); both real GitHub threads are resolved before the
sandbox-only merge. [[github-review-thread]] performs paginated REST-comment →
GraphQL-thread translation. Guarded cleanup restores README-only default-branch
state, and an identical run id completed again with no residual
branch/container/volume. DRIFT remains 0.

## Deepening

ADR: [[ADR-0001-architecture-foundation]] (edge isolation). Bridge design binds
ACP's native review gate ([[review-comment-service]] / [[grill-service]]) to real
GitHub PRs.

## Classification Grill Log

- **Q:** Is an optional external-process bridge `CRITICAL` because it can merge a
  pull request? **A:** No. Its mutation is high-impact but its availability is not
  on the ACP host's core path; with one production adapter it is `EXPLORATORY` at
  capacity 2. _Rejected:_ `CRITICAL` (confuses operation impact with host failure
  criticality).
- **Q:** Should `EDGE` remain a capacity class? **A:** No. Edge isolation describes
  topology, while FMCF capacity is `BACKBONE`, `CRITICAL`, `EXPLORATORY`, or
  `INTERNAL`. Keep edge isolation in prose and use `EXPLORATORY` in governance.
  _Rejected:_ non-standard `EDGE/STABLE` frontmatter (breaks dashboard queries).

## Referenced by

[[gh-bridge]] · [[Transport]] · [[architecture/_MOC]]
