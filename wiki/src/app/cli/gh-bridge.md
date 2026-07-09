---
type: module
path: '@root/src/app/cli/gh-bridge.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[GitHub]]'
depth_score: 0.6
depth_status: MEDIUM
tags: [module, medium]
aliases: [gh-bridge, runGhBridge, acp-gh]
---

# gh Bridge

## Purpose

The `acp gh import|sync|merge` bridge program: an Effect orchestration that binds
ACP's native review gate to real GitHub PRs. It calls GitHub through the
[[github-gateway|GitHubGateway]] seam and ACP through its own HTTP API (reusing
[[client|runCliRequest]] via [[gh-bridge-support]]). No domain service or the main
server layer depends on `gh` — the [[GitHub]] seam is composed only here.

## Interface

### Signatures

```typescript
export const runGhBridge: (
  argv: readonly string[],
) => Effect<
  void,
  BridgeError | GitHubError,
  GitHubGateway | HttpClient.HttpClient
>
```

### Linkage

- **Requires:** [[github-gateway]] (`GitHubGateway`, `parsePrRef`, `MergeMethod`),
  [[gh-bridge-support]] (`acpGet`/`acpPost`/`BridgeError`), [[gh-reconcile]]
  (comment reconcile + merge-gate helpers), `@effect/platform` `HttpClient`.
- **Consumed by:** [[cli-main]] (dispatches `argv[0] === 'gh'` here, providing
  `GitHubGatewayGhLive`).

## Algorithm

`runGhBridge` resolves `baseUrl`/token from `ACP_BASE_URL`/`ACP_PORT`/`ACP_RPC_TOKEN`
(same as [[cli-main]]) and dispatches on `argv[1]`:

- **import** (`<pr> --work --workspace`): `fetchPullRequest` + `fetchDiff`, then
  `POST /v1/artifacts` twice — a `diff` artifact (content = diff) and a
  `pull_request` artifact (uri = PR url).
- **sync** (`<pr> --work --review --artifact`): idempotent bidirectional reconcile
  (see [[gh-reconcile]]) — post unstamped ACP-origin comments to GitHub and stamp
  the returned id via `POST /v1/review-comments/:id/external-id`; import GitHub
  comments not yet mirrored as `origin:'github'` ACP comments; propagate resolved
  ACP comments to GitHub thread resolution. Everything keys off provenance +
  `external_id`, so re-runs are no-ops.
- **merge** (`<pr> --work [--method]`): read the [[resume-schema|resume packet]],
  `postIssueComment` with the decision summary, then merge **only if** the
  read-only gate passes (a review approved, latest grill passed, no open comments);
  otherwise fail with `BridgeError` listing reasons and never call `merge`.

## Negative Logic

The merge gate is READ-ONLY — it consumes `reviews`/`latest_grill`/`open_comments`
from the resume packet and does not re-run `grill evaluate`, so merge never mutates
ACP state. A blocked merge fails before the gateway `merge` call. Unknown
subcommands fail with `BridgeError`.

## Grill Log

- **Q (blocker):** How does the bridge stay off the domain core / server layer?
  **A:** it is a CLI-only program; the [[GitHub]] seam is provided in `main.ts` on
  the `gh` path only, and a pure-core invariant test forbids `infrastructure/github`
  / `child_process` / `` `gh ` `` in `src/domain/**`, `app-live.ts`, `http-app.ts`.
- **Q (major):** Why post the decision comment before the gate check, even on a
  refusal? **A:** the PR should always carry ACP's verdict; the summary states the
  blocking reasons whether or not the merge proceeds.
- **Q (minor):** Why does resolve propagation re-call on every sync? **A:** the
  fake/REST list can't report GitHub-side resolution, and `resolveReviewThread` is
  itself idempotent on GitHub, so best-effort re-resolve is safe.
