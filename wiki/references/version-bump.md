---
type: reference
tags: [reference, versioning, tooling, release]
aliases: [version-bump, acp-bump]
---

# Version Bump (`acp bump`)

`pnpm bump` is ACP's repository-local version planning and mutation tool. It
implements [[ADR-0016-version-bump-policy]] and never calls a running ACP host at
runtime. Development and review of the tool still use the Dockerized ACP host as
the coordination plane under [[ADR-0012-acp-self-agent-audit]].

## Version lines

- Release version: three-part semver from `package.json`, inferred from complete
  conventional-commit records.
- Protocol version: two-part value from [[protocol-version]], changed only by an
  explicit `--protocol` decision.

The lines are independent. A release feature does not imply a protocol change;
a protocol change does not imply a release level.

## Commands

```bash
# First repository baseline: preview, then create the annotated current tag.
pnpm bump --baseline --dry-run
pnpm bump --baseline --yes

# Plan from the newest reachable release tag without writing.
pnpm bump --dry-run

# Apply the inferred release plan after non-interactive confirmation.
pnpm bump --yes

# Make explicit compatibility decisions.
pnpm bump --release minor --yes
pnpm bump --protocol major --yes
pnpm bump --release patch --force --yes

# Use an explicit commit/ref instead of a release tag.
pnpm bump --since origin/main --dry-run
```

Without `--yes`, apply prompts only on an interactive TTY. Non-interactive
execution fails closed. `--dry-run` never writes or prompts. Invalid flags,
missing values, dirty apply trees, missing baselines, policy undercuts, and
anchor drift exit non-zero.

Ordinary bump execution never tags the repository because its file edits are not
yet committed. After a release change, commit the reviewed diff and then run the
printed `git tag v<version>` command or use the release workflow.

## Module layout

- `scripts/bump/semver.mjs` — strict release/protocol arithmetic.
- `scripts/bump/policy.mjs` — release inference and override validation.
- `scripts/bump/parse-commits.mjs` — full subject/body conventional parsing.
- `scripts/bump/collect.mjs` — reachable baseline and git evidence adapter.
- `scripts/bump/rewrite.mjs` — validated pure file transforms.
- `scripts/bump/transaction.mjs` — temp-file replace and rollback boundary.
- `scripts/bump/args.mjs` — fail-closed command-line grammar.
- `scripts/acp-bump.mjs` — plan, confirmation, baseline, and apply orchestration.

Each module is directly importable by Vitest and Node without a TypeScript build.
The entrypoint exports its pure planning/application seams for focused tests and
runs only when invoked as the main module.

## Failure recovery

All transforms validate before any write. The transaction captures original
bytes, replaces files through same-directory temporary files, and restores
earlier replacements if a later rename fails. A rollback failure is a distinct
fatal outcome and lists affected paths without claiming success.

## Production gate

Run focused bump tests first, followed by typecheck, lint, formatting, policy
checks, the full suite, build, mirror parity, and `pnpm dogfood:docker-self`.
Issue #321 owns the initial implementation and publication lifecycle.

## Referenced by

[[ADR-0016-version-bump-policy]] · [[references/_MOC]] · [[README]] ·
[[2026-07-13-acp-bump-version]]
