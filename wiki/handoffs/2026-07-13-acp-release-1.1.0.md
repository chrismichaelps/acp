---
date: 2026-07-13
topic: acp-release-1.1.0
from_role: Release Steward
to_role: Forensic Guardian
status: RELEASED
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
- Applied the reviewed plan from a clean tree. `package.json` and README now
  report release `1.1.0`, the protocol constant and README protocol label remain
  `0.1`, and the generated ledger entry records only the release change.
- Passed typecheck, lint, formatting, repository policy checks, production build,
  102 focused tests, the controlled full suite (637 passed, 13 skipped), and
  exact 255/255 source/wiki parity.
- The local Docker gate compiled ACP inside the release image, then Docker
  Desktop failed its overlay metadata write because the host data volume reached
  100% capacity. No ACP assertion failed. The required remote Docker self-dogfood
  check remains the merge gate on clean CI infrastructure.
- Opened ready release PR #323 from `codex/release-1.1.0` to `main`. Required CI
  passed: Local Gates in 1m32s and Complete Docker self-dogfood in 4m48s.
- Reconciled final evidence and re-passed required CI: Local Gates in 1m22s and
  Complete Docker self-dogfood in 4m57s.
- Squash-merged PR #323 to `main` at
  `3fe6a370e9346578551ab593337d60331442134c`.
- Created and pushed annotated tag `v1.1.0` at that exact merge commit and
  published GitHub release `ACP v1.1.0`.

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

None for release `v1.1.0`.

## Exact next action

Forensic Guardian: retain this page as the immutable release evidence handoff.
Future version changes begin from annotated baseline `v1.1.0` through
[[version-bump]].

## Links

[[ADR-0016-version-bump-policy]] · [[version-bump]] · [[protocol-version]] ·
[[grammar/typescript]] · [[CHANGELOG]]
