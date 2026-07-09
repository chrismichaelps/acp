---
type: module
path: '@root/src/infrastructure/github/github-gateway-gh.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[GitHub]]'
depth_score: 0.5
depth_status: MEDIUM
tags: [module, medium]
aliases: [github-gateway-gh, GitHubGatewayGhLive, makeGhGateway]
---

# GitHubGateway (gh adapter)

## Purpose

The production [[GitHub]] adapter: implement `GitHubGatewayApi` by shelling out to
the `gh` CLI through the confined [[node-process-io|runProcess]] primitive.

## Interface

### Signatures

```typescript
export type RunProcess = (
  command: string,
  args: readonly string[],
  options?: { input?: string },
) => Effect<ProcessResult>
export const makeGhGateway: (run: RunProcess) => GitHubGatewayApi
export const GitHubGatewayGhLive: Layer.Layer<GitHubGateway>
```

`makeGhGateway` is dependency-injected on `run`, so tests pass a fake runner that
returns canned `gh` output and asserts argv; `GitHubGatewayGhLive` binds the real
`runProcess`.

### Linkage

- **Requires:** [[node-process-io]] (`runProcess`/`ProcessResult`),
  [[github-gateway]], [[github-types]], [[github-error]].
- **Consumed by:** [[cli-main]] (provides `GitHubGatewayGhLive` on the `gh` path).

## Algorithm

Two helpers wrap the runner: `ghText(run)(argv)` runs `gh`, and on non-zero exit
fails with `GitHubError` else returns stdout; `ghJson(run)(argv)` parses that text
as JSON (parse failure → `GitHubError`). Methods map to `gh` invocations:

- `fetchPullRequest` → `gh pr view <n> --repo o/r --json number,url,headRefOid,baseRefOid,state,mergeable,title` (mergeable `=== 'MERGEABLE'`).
- `fetchDiff` → `gh pr diff <n> --repo o/r`.
- `listReviewComments` / `postReviewComment` → `gh api repos/o/r/pulls/<n>/comments` (REST), mapped through `toReviewComment` (`user.login → author`, `in_reply_to_id → in_reply_to`, `resolved` always `false`).
- `resolveReviewThread` → `gh api graphql` with the `resolveReviewThread` mutation.
- `postIssueComment` → `gh pr comment <n> --body <b> --repo o/r`.
- `merge` → `gh pr merge <n> --<method> --repo o/r`.

## Negative Logic

Only [[node-process-io]] spawns a process; this module never calls
`child_process` directly. Arguments are always an argv array (`shell: false`) — no
shell-string interpolation. ACP never reads/stores/forwards a token; auth is
`gh`'s own. A non-zero exit is a typed `GitHubError`, never a throw.

## Grill Log

- **Q (blocker):** How is a shell-out adapter tested without `gh` present?
  **A:** `makeGhGateway(run)` injects the runner; unit tests pass a fake `run`
  that scripts stdout/exit-code by argv substring and asserts the argv ACP built.
- **Q (major):** Why REST for comments but GraphQL for resolve? **A:** thread
  resolution is only exposed via the GraphQL `resolveReviewThread` mutation; the
  comment list/post live on the REST pulls/comments endpoint.
