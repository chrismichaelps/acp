---
date: 2026-07-13
topic: acp-bump-version
from_role: DNA Engineer
to_role: Shadow
status: READY_FOR_IMPLEMENTATION
maturity: EXPLORING
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

- Implement strict args, semver, policy, full commit parsing, git collection,
  pure rewrites, transaction, and orchestration with focused tests.
- Add `pnpm bump` and README usage.
- Reconcile the implementation details into [[version-bump]] and this handoff.
- Run the complete repository and Docker self-dogfood gates.
- Record independent ACP review evidence, then commit/push/PR/merge issue #321.

## Exact next action

Shadow: read [[ADR-0016-version-bump-policy]], [[version-bump]],
[[protocol-version]], and [[grammar/typescript]] completely. Implement the pure
argument and semver modules with their failure regressions first. Do not write
files or create tags until the transaction and confirmation tests exist.

## Links

[[ADR-0016-version-bump-policy]] · [[version-bump]] · [[protocol-version]] ·
[[ADR-0012-acp-self-agent-audit]] · [[grammar/typescript]] · [[CHANGELOG]]
