---
type: decision
status: ACCEPTED
date: 2026-07-13
tags: [adr, accepted, versioning, tooling, release]
aliases: [ADR-0016, version-bump-policy]
---

# ADR-0016 — Production-Safe Version Bump Policy

## Status

ACCEPTED for issue #321. This decision governs the repository-local
[[version-bump]] tool. It does not publish packages, create release commits, or
change protocol compatibility semantics beyond the existing
[[protocol-version]] constant.

## Context

ACP has two independent version lines:

- the three-part release version in `@root/package.json`; and
- the two-part wire version owned by [[protocol-version]].

Documentation, tests, internal refactors, release behavior, and wire-contract
changes have different compatibility impact. Bumping both lines after every
merge creates noise; inferring wire compatibility from a textual diff is unsafe.
The repository also has no release tag baseline, so interpreting all history as
unreleased work would produce a false first proposal.

## Decision

### Independent version lines

Release and protocol versions never imply one another.

| Evidence                                          | Release level |
| ------------------------------------------------- | ------------- |
| breaking conventional commit                      | `major`       |
| `feat`                                            | `minor`       |
| `fix` or `perf`                                   | `patch`       |
| docs/test/chore/refactor/style/ci/build only      | `none`        |
| unknown/non-conventional commits without breaking | `none` + warn |

The highest release level wins. An explicit release override below the inferred
level fails unless `--force` is present.

Protocol changes are never inferred. A diff under `src/protocol/` produces a
warning and `none`; only `--protocol major|minor|patch|none` records the operator
decision. While the protocol is `0.y`, both `major` and `minor` advance `y`, and
`patch` is a no-op because the protocol has no patch slot. At `1.y` and later,
`major` advances/reset and `minor` advances; `patch` remains a no-op.

### Evidence and baseline

The collector uses the newest reachable `v*` tag from `HEAD`, not a tag on an
unrelated branch. `--since <ref>` must resolve to a commit and overrides tag
discovery. Full commit subject and body records are parsed, so `!`,
`BREAKING CHANGE:`, and `BREAKING-CHANGE:` evidence is preserved.

Without a reachable tag or `--since`, ordinary planning fails. The explicit
`--baseline` mode creates annotated `v<package-version>` at the current committed
`HEAD` after confirmation. It never edits versions. Existing tags, dirty state,
invalid package versions, and non-interactive execution without `--yes` fail
before tag creation. `--baseline --dry-run` is non-mutating.

An automatically discovered canonical `vX.Y.Z` baseline must equal the current
top-level package version. A mismatch indicates an interrupted commit/tag flow
and fails closed before inference, preventing the same commit evidence from
advancing the release twice. Recovery creates the missing tag at the reviewed
release commit or uses explicit `--since <ref>` intent.

### CLI contract

```text
pnpm bump [--release <level>] [--protocol <level>] [--since <ref>]
          [--force] [--yes] [--dry-run]
pnpm bump --baseline [--yes|--dry-run]
```

Unknown flags, missing values, invalid levels, repeated value flags, and
baseline/bump flag mixtures are usage errors. `--dry-run` prints the complete
plan and never prompts or mutates. Apply requires either an interactive TTY
confirmation or `--yes`; EOF/negative answers cancel without mutation.

Ordinary bump execution does not create a release tag. Until the version edits
are committed, `HEAD` still represents the old version, so immediate tagging
would be incorrect. After a release bump the tool prints the exact post-commit
tag command for the operator or release workflow.

### Transactional mutation

The apply path reads `package.json`, `src/protocol/version.ts`, and
`wiki/CHANGELOG.md` once, validates all required anchors, and precomputes every
output before writing. Package rewriting validates the parsed top-level version
and exactly one matching textual field. Protocol rewriting validates exactly one
matching `ACP_PROTOCOL_VERSION` literal; the supported tuple and schema already
derive from it. The changelog insertion targets the ledger heading.

Changed files are written to same-directory temporary files, flushed, and
renamed over their destinations. If a later replacement fails, the transaction
restores every already-replaced file from captured original bytes. Incomplete
rollback is reported distinctly with every affected target path. Temporary files
are cleaned on success and failure. No partial success is presented as an
applied bump.

The apply path refuses a dirty worktree. This prevents the tool from mixing a
version transaction with unrelated user edits and makes rollback evidence
unambiguous. Interactive confirmation is a concurrency boundary: immediately
after a positive answer, apply revalidates a clean worktree and unchanged
captured `HEAD` before mutation. Baseline mode tags that captured commit rather
than a mutable symbolic ref.

## Module boundary

The capability is developer tooling, not ACP runtime behavior. It stays under
`@root/scripts/bump/` as small ESM modules plus the thin
`@root/scripts/acp-bump.mjs` entrypoint. It therefore receives a
[[version-bump]] reference page rather than `wiki/src/` mirrors. Node built-ins
remain at this tooling boundary and do not enter domain/protocol modules.

## Consequences

- Most merges produce no version change.
- Operators must make protocol compatibility intent explicit.
- The first release baseline is an intentional, auditable action.
- Release tagging remains a post-commit release-flow responsibility.
- File-shape drift fails closed instead of producing a partially rewritten tree.
- Publishing, release commits, changelog generation beyond the one-line ledger,
  and CI enforcement remain out of scope.

## Alternatives

**Bump both lines after every merge** — rejected as meaningless churn.

**Infer protocol compatibility from source diffs** — rejected because syntax
cannot prove wire compatibility or semantic breakage.

**Create a release tag immediately after writing files** — rejected because the
tag would point to the pre-bump commit.

**Sequential direct writes with a reconciliation warning** — rejected because
operators need all-or-nothing behavior, not a documented partial state.

**Put policy in `src/domain/versioning/`** — rejected because this is local
repository tooling and should run without compiling runtime output.

## Validation

Acceptance requires strict semver/argv unit tests, subject-and-body commit
fixtures, baseline reachability and collision tests, no-baseline and dirty-tree
failures, dry-run immutability, confirmation refusal, explicit protocol and
forced release overrides, successful isolated-repository apply, injected
transaction failure with rollback, repository static/full gates, and production
Docker ACP self-dogfood. The wiki/code mirror audit remains 255/255 because no
new `src/` file is introduced.

## Grill Log

- **Q:** Can the tool safely create the release tag? **A:** Not during the bump;
  print a post-commit command. _Rejected:_ tagging the old `HEAD`.
- **Q:** Are commit subjects sufficient breaking evidence? **A:** No; parse
  subject and body trailers with unambiguous separators. _Rejected:_ subject-only
  `git log --pretty=%s`.
- **Q:** May dry-run operate on a dirty tree? **A:** Yes, because it does not
  write; the output must disclose dirtiness. Apply and baseline creation refuse
  it. _Rejected:_ blocking read-only planning.
- **Q:** Is per-file atomic replacement sufficient? **A:** No; capture originals
  and roll back the logical three-file transaction. _Rejected:_ partial success.
- **Q:** Should unknown commits force a conservative major bump? **A:** No; warn
  and require an explicit override when the operator believes they are
  releasable. _Rejected:_ turning malformed metadata into automatic churn.

## Referenced by

[[ADR-0004-protocol-version-codecs-generated-client]] · [[protocol-version]] ·
[[version-bump]] · [[decisions/_MOC]] · [[architecture/_MOC]] · [[CHANGELOG]] ·
[[2026-07-13-acp-bump-version]]
