---
date: 2026-07-10
topic: gh-bridge-sandbox-live-validation
from_role: Forensic Guardian
to_role: Forensic Guardian
status: READY_TO_MERGE
maturity: EXPLORING
tags: [handoff]
---

# Handoff — GitHub Bridge Sandbox Live Validation

## Done

- Reconciled [[gh-bridge]] and [[GitHub]] with the real validation state: the
  opt-in lane is implemented and offline-green, but has not yet mutated GitHub.
- Hardened the lane to rebuild the host CLI by default, create nested sandbox
  marker directories, and assert retained-PR sync idempotency from a baseline.
- Added focused support regressions; format, lint, typecheck, file-size, env,
  runtime-pin, build, and full Vitest gates pass (474 passed, 13 skipped).
- Provisioned private `chrismichaelps/acp-gh-sandbox` with the sentinel topic,
  warning README, disposable description, and automatic merged-branch deletion.
- Ran `issue-268-live-1`: repository guard, import, bidirectional sync,
  idempotency, and denied merge executed; grill evaluation then returned
  `incomplete` because two review comments were still open. No allowed merge
  occurred. Default cleanup closed PR #1, deleted its branch, and removed the
  Docker container/volume.
- Added [[github-review-thread]] with paginated typed lookup and split regression
  suites; [[github-gateway-gh]] now skips already-resolved threads or mutates with
  the resolved GraphQL node id. Reordered the lane to resolve → sync resolution →
  evaluate grill → approve. Focused typecheck, lint, and 19 tests pass.
- Corrected rerun succeeded on sandbox PR #2: two gate comments record requested /
  none / 2 unresolved before denial and approved / passed / 0 unresolved before
  merge; both review threads are resolved and the PR merged only in the private
  sandbox. Container, volume, and branch cleanup passed.
- Added guarded post-merge marker cleanup: re-validates repo/ref and the closed
  `sandbox/<safe-run-id>.md` path, resolves the default branch, deletes by current
  blob SHA, and verifies 404 afterward. Focused typecheck, lint, and 22 tests pass.
- Cleaned PR #2's merged marker through the projected helper; sandbox `main` is
  back to README-only state at cleanup commit `f102e01`.
- Reused identical run id `issue-268-live-1` successfully on PR #3. Both threads
  resolved, red/green gate comments are durable, sandbox-only merge succeeded,
  cleanup commit `9f90293` restored README-only `main`, and only branch `main`
  remains with no Docker container/volume.
- Full format, lint, typecheck, file-size, env, runtime-pin, build (148 runtime
  files), and Vitest gates pass (484 passed, 13 skipped).

## Decided (do not re-litigate)

- Never run against a repository without the `acp-disposable-sandbox` topic.
- The user's full-continuation authorization permits provisioning the dedicated
  private `chrismichaelps/acp-gh-sandbox` fixture.
- Retain that empty sandbox repository for future manual runs; clean generated
  branches and PRs after each successful run.
- Keep GitHub credentials owned by host `gh`; never pass them into ACP or Docker.
- Live success requires denied-before-allowed merge in the disposable repository.

## Open / Remaining

- Push the completed correction to PR #290, require CI + Docker green, then
  squash-merge and confirm issue #268 closes.

## Exact next action

Forensic Guardian: commit and push the synchronized wiki/code delta to PR #290,
wait for CI + complete Docker self-dogfood, then squash-merge. Confirm issue #268
is closed and local `main` matches the merge commit.

## Links

[[gh-bridge]] · [[GitHub]] · [[grammar/typescript]]
