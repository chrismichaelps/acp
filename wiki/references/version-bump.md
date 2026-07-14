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
- Public status: one canonical `README.md` line that displays both values and is
  rewritten from the same validated plan.

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
anchor drift exit non-zero. After an interactive confirmation, the tool checks
clean state and the captured `HEAD` again before mutation; baseline mode tags
that captured commit.

When automatic discovery selects a canonical `vX.Y.Z` tag, that version must
match `package.json`. A mismatch is treated as an interrupted post-commit tag
step and refuses to infer another bump. Create the missing reviewed release tag
or select an intentional recovery boundary with `--since <ref>`.

Ordinary bump execution never tags the repository because its file edits are not
yet committed. After a release change, commit the reviewed diff and then run the
printed annotated `git tag -a v<version>` command or use the release workflow.

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
The entrypoint exports its orchestration seam for direct tests, is exercised as a
real CLI in temporary repositories, and runs automatically only when invoked as
the main module.

## Failure recovery

All transforms validate before any write. The transaction captures original
bytes, replaces files through same-directory temporary files, and restores
earlier replacements if a later rename fails. A rollback failure is a distinct
fatal outcome with structured affected paths; the CLI prints those paths without
claiming success.

Package rewriting requires exactly one textual `version` anchor matching the
parsed top-level package version; unrelated nested tooling versions remain
untouched. README rewriting requires exactly one status anchor matching both
current versions, preventing stale public status from being accepted or carried
forward. Immediately before creating temporary files, the transaction compares
every target with the source snapshot used to build the plan. Concurrent source
drift fails closed instead of overwriting newer work.

## Production gate

Run focused bump tests first, followed by typecheck, lint, formatting, policy
checks, the full suite, build, mirror parity, and `pnpm dogfood:docker-self`.
Issue #321 owns the initial implementation and publication lifecycle.

## Referenced by

[[ADR-0016-version-bump-policy]] · [[references/_MOC]] · [[README]] ·
[[2026-07-13-acp-bump-version]] · [[2026-07-13-acp-release-1.1.0]]
