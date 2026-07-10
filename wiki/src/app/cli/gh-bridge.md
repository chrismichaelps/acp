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

## Sandbox dogfood lane (opt-in)

`pnpm dogfood:docker-gh-sandbox`
(@root/scripts/acp-docker-gh-sandbox.mjs) is the live Docker evidence for the
bridge. It runs the ACP host in Docker and the `acp gh` bridge on the **host**
(shelling to the host's `gh`), then drives import → idempotent bidirectional sync
→ denied-before-allowed merge against a **disposable** GitHub PR. It is
deliberately **not** part of the offline `dogfood:docker-self` CI gate, because
`gh merge` mutates an external PR and needs authenticated merge authority.

**Guards (fail closed).** The lane refuses to run unless `ACP_GH_SANDBOX_REPO`
names an `owner/repo`, `gh auth status` succeeds, and that repo carries the
`acp-disposable-sandbox` topic. Every gh mutation re-asserts its PR ref matches
the sandbox repo. Credentials stay owned by `gh` — the container never receives a
GitHub token and ACP never persists one.

**Prerequisites.**

- an authenticated `gh` (`gh auth login`) with merge rights on the sandbox repo;
- a throwaway repo tagged with the `acp-disposable-sandbox` topic
  (`gh repo edit <owner/repo> --add-topic acp-disposable-sandbox`);
- Docker, and `export ACP_GH_SANDBOX_REPO=<owner>/<repo>`.

**Run / rerun.** `pnpm dogfood:docker-gh-sandbox`. The lane identifies or creates
an open `acp-sandbox/<run-id>` PR. A new branch creates its nested sandbox marker
directory before writing the diff fixture. Reusing a retained PR measures comment
growth from the PR's existing baseline, then asserts that a second `sync` adds no
GitHub or ACP duplicates. Each whole rerun intentionally adds one fresh ACP-origin
and one fresh GitHub-origin comment pair for that run; idempotency applies to
reconciliation, not to repeated scenario seeding.

**Cleanup.** By default the lane tears down the Docker stack and closes the PR +
deletes its branch. Set `ACP_GH_SANDBOX_KEEP=true` to retain the stack and PR for
inspection. The host CLI is rebuilt from the current checkout by default, even
when `dist` already exists. `ACP_DOCKER_SKIP_BUILD=true` reuses the Docker image;
`ACP_GH_SANDBOX_SKIP_BUILD=true` reuses an existing host `dist` and fails early if
that entrypoint is absent.

**On failure.** A failed run may leave the disposable PR open and its
`acp-sandbox/<run-id>` branch present (and, if teardown was skipped, the Docker
stack). All are harmless on a disposable repo and cleared by a rerun or manual
`gh pr close --delete-branch`; no non-sandbox repo is ever touched, and no
credential is persisted.

**Validation status.** Offline formatting, lint, typecheck, syntax, and CI Docker
gates pass; the local full suite reports 474 passed and 13 skipped, including
focused support regressions for current-checkout builds, missing skip-build output,
and nested marker creation. The live lane remains pending until an authenticated
repository carrying the `acp-disposable-sandbox` topic is available; no current
account repository has that sentinel, so the lane has correctly not mutated GitHub
yet.

## Sandbox Grill Log

- **Q:** Can the lane accidentally test stale host bridge code when `dist` already
  exists? **A:** No. Default execution always rebuilds the host CLI; only the
  explicit `ACP_GH_SANDBOX_SKIP_BUILD=true` escape hatch may reuse `dist`, and it
  must verify the entrypoint exists. _Rejected:_ build only when absent (silently
  validates an older checkout).
- **Q:** How does a fresh PR create `sandbox/<run-id>.md` when the repository has no
  `sandbox/` directory? **A:** Create the marker's parent directory recursively
  before writing it. _Rejected:_ require the disposable repository to pre-create
  fixture directories (unnecessary hidden setup).
- **Q:** How can a retained PR be reused without assuming it has zero comments?
  **A:** Capture the GitHub comment baseline, assert the current run adds exactly
  the seeded GitHub comment plus the mirrored ACP comment, then assert the second
  sync leaves both sides unchanged. _Rejected:_ absolute count `2` (fails valid
  retained-PR reruns and does not isolate reconciliation idempotency).
