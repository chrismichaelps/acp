---
date: 2026-07-13
topic: acp-bump-version
from_role: DNA Engineer
to_role: Shadow
status: REVIEW_CHANGES_REQUESTED
maturity: MEDIUM
tags: [handoff, versioning, tooling, release]
---

# Handoff — Production-Safe ACP Version Bump

## Done

- Accepted [[ADR-0016-version-bump-policy]] after reconciling its number with
  the merged authorization ADRs.
- Defined [[version-bump]] as repository-local ESM tooling, not an ACP RPC
  command or `src/` runtime module.
- Resolved baseline, commit-body evidence, strict argv, interactive/non-
  interactive confirmation, protocol explicitness, dirty-tree, transactional
  rollback, and release-tag timing.
- Created GitHub issue #321 as the feature contract.
- Implemented strict arguments, semver arithmetic, independent policy, full
  commit-body parsing, resolved-SHA evidence collection, anchor-validated
  rewrites, source-drift detection, rollback-capable transactions, and the
  repository-local CLI.
- Added 92 focused tests, including temporary-repository baseline, dry-run,
  confirmation, dirty-tree, protocol independence, and no-premature-tag proofs.
- Ran the tool against this branch with `--since origin/main --dry-run`. The
  first run exposed a nested `devEngines.packageManager.version` anchor gap; the
  matching-anchor rule was corrected and regressed before the successful run.
- Passed typecheck, lint, repository policies, 627 full-suite tests, production
  build, exact 255/255 source mirror parity, and complete Docker self-dogfood.

## Decided (do not re-litigate)

- Release inference: breaking → major; feat → minor; fix/perf → patch; non-
  observable types and unknown commits → none, with unknown warnings.
- Protocol evidence never selects a level. Only `--protocol` does.
- `--baseline` is the only tag mutation and labels the current committed version.
- Ordinary bump prints a post-commit tag command; it never tags uncommitted edits.
- Apply is one rollback-capable transaction across package, protocol, and ledger
  files, and refuses a dirty tree.
- The tool stays under `scripts/bump/`; source/wiki mirror parity remains 255/255.

## Open / Remaining

- Close independent-review blockers: revalidate clean state and captured `HEAD`
  after interactive confirmation, and expose structured affected paths when
  rollback is incomplete.
- Re-run focused and impacted production gates, then obtain reviewer approval.
- Record independent ACP review evidence, push the branch, open and merge the
  issue-closing PR, and verify issue #321 is closed.

## Exact next action

DNA Engineer: add prompt-race integration regressions plus structured rollback
path assertions, then implement the two review fixes exactly as specified in
[[ADR-0016-version-bump-policy]]. Re-run focused/static gates and return the diff
to Shadow. Do not run an apply or create a release tag in this repository.

## Links

[[ADR-0016-version-bump-policy]] · [[version-bump]] · [[protocol-version]] ·
[[ADR-0012-acp-self-agent-audit]] · [[grammar/typescript]] · [[CHANGELOG]]
