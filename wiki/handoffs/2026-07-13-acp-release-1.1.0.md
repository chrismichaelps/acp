---
date: 2026-07-13
topic: acp-release-1.1.0
from_role: Forensic Guardian
to_role: Release Steward
status: READY_FOR_BUMP
maturity: EXPLORING
tags: [handoff, versioning, release]
---

# Handoff — ACP Release 1.1.0

## Done

- Re-anchored to [[ADR-0016-version-bump-policy]], [[version-bump]], and
  [[protocol-version]].
- Selected release `1.1.0` from the merged `feat(versioning)` evidence since the
  previous main commit; retained protocol `0.1` because no compatibility change
  is part of this release.
- Defined the public README status as one strict line containing both independent
  versions so future bumps cannot recreate the observed ambiguity.
- Implemented README parsing and rewriting as the fourth validated transaction
  target, including stale/duplicate anchor refusal and CRLF preservation.
- Passed 102 focused tests, targeted lint/typecheck/format checks, and an
  independent review with no actionable findings.
- Ran the real dirty-tree-safe preview from `b8d21b0`; it proposes release
  `1.0.0 → 1.1.0`, protocol `0.1 → 0.1`, README synchronization, and the release
  ledger entry without editing files.

## Decided (do not re-litigate)

- The bump transaction must validate and rewrite `README.md` together with
  `package.json`, the protocol constant when selected, and `wiki/CHANGELOG.md`.
- A missing, repeated, or stale README status anchor fails before mutation.
- This repository has no `dev` branch, so release preparation uses a clean branch
  from current `origin/main` and returns through a reviewed PR to `main`.
- The release tag is created only from merged `main`, never from the unmerged
  release branch.

## Grill Log

- **Q:** Should README continue to say only `v0.1`? **A:** No; label release and
  protocol separately. _Rejected:_ relying on readers to infer which version the
  unqualified number represents.
- **Q:** Is manual README editing sufficient? **A:** No; make it a validated
  transaction target. _Rejected:_ a release checklist item with no fail-closed
  enforcement.
- **Q:** Should protocol advance with release `1.1.0`? **A:** No; no wire
  compatibility decision or protocol source change exists. _Rejected:_ coupling
  independent version lines for cosmetic alignment.
- **Q:** Where should `v1.1.0` point? **A:** The squash merge commit on `main`.
  _Rejected:_ tagging the pre-bump or unreviewed branch commit.

## Open / Remaining

- Apply `pnpm bump --since b8d21b0 --protocol none --yes` from a clean tree.
- Run focused and full gates, Docker ACP dogfood, merge the release PR, create the
  annotated tag, and publish the GitHub release.

## Exact next action

Release Steward: commit the reviewed implementation, apply the exact explicit-
baseline bump from a clean tree, then verify all four generated file changes
before running the production release gates.

## Links

[[ADR-0016-version-bump-policy]] · [[version-bump]] · [[protocol-version]] ·
[[grammar/typescript]] · [[CHANGELOG]]
