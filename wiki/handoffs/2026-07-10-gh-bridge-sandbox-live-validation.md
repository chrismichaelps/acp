---
date: 2026-07-10
topic: gh-bridge-sandbox-live-validation
from_role: Forensic Guardian
to_role: Shadow
status: IN_PROGRESS
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

## Decided (do not re-litigate)

- Never run against a repository without the `acp-disposable-sandbox` topic.
- Do not create or retag an external repository without explicit user authority.
- Keep GitHub credentials owned by host `gh`; never pass them into ACP or Docker.
- Live success requires denied-before-allowed merge in the disposable repository.

## Open / Remaining

- No repository visible to the authenticated account currently has the sentinel
  topic, so issue #268's first live execution is still pending.
- PR #290 contains the lane and its offline validation.

## Exact next action

Once the user names an existing disposable `owner/repo` or authorizes creation of
one, add the `acp-disposable-sandbox` topic if needed, set
`ACP_GH_SANDBOX_REPO=owner/repo`, and run
`node --run dogfood:docker-gh-sandbox`. Record the resulting PR/run evidence in
[[gh-bridge]], [[GitHub]], and [[CHANGELOG]] before merging PR #290.

## Links

[[gh-bridge]] · [[GitHub]] · [[grammar/typescript]]
