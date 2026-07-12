---
type: module
path: '@root/src/app/cli/gh-merge.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[GitHub]]'
tags: [module, test, app, cli, github, review-gate]
aliases: [gh-merge.test]
---

# GitHub Merge Gate Tests

## Purpose

Prove `acp gh merge` posts an auditable decision and invokes [[GitHub]] merge
only when ACP review, [[Grill]], and comment obligations are all satisfied.

## Interface

Vitest integration suite using a live ACP server, [[github-gateway-fake]], and
the real [[gh-bridge]] orchestration.

## Algorithm

For the green path, create scoped planner/worker/reviewer identities, drive work
to review, complete an accepted grill round with resolved comment, approve, and
invoke merge. Require one squash merge and a decision comment reporting passed
with zero unresolved comments. For the red path, leave work without required
gate evidence, require the Effect to fail, and assert the gateway recorded no
merge.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT merge merely because GitHub reports the pull request mergeable.
- ❌ Do NOT omit the decision comment on the passing path.
- ❌ Do NOT convert a blocked gate into a successful no-op.
- ❌ Do NOT call the gateway merge method when ACP evidence is incomplete.

## Grill Log

- **Q:** Why test against a live ACP server rather than a fabricated resume
  packet? **A:** The pure gate has its own suite; this test proves bridge HTTP,
  auth, resume composition, decision posting, and external mutation order.
  _Rejected:_ orchestration tests that mock away ACP state.

## Referenced by

[[gh-bridge]] · [[gh-reconcile]] · [[github-gateway-fake]] · [[cli/_MOC]] ·
[[GitHub]] · [[src/_MOC]]
