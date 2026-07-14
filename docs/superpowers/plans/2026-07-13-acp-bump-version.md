# `acp bump` — Production Semver Implementation Plan

**Issue:** #321

**Branch:** `feat/acp-bump-version` from `main`

**Goal:** Ship a fail-closed repository-local tool that plans and applies only
justified release/protocol version changes.

## Governing truth

Read these completely before implementation:

- `SKILL.md`
- `wiki/decisions/ADR-0016-version-bump-policy.md`
- `wiki/references/version-bump.md`
- `wiki/src/protocol/version.md`
- `wiki/grammar/typescript.md`
- `wiki/handoffs/2026-07-13-acp-bump-version.md`

The wiki controls if this plan or the older design narrative conflicts with it.
The capability is plain Node ESM under `scripts/bump/`; it does not enter ACP's
runtime `src/` tree and does not need a TypeScript build before tests.

## Production constraints

- Node 24, pnpm 11.7.0, Vitest 4.
- One focused module per responsibility; target about 200 lines per `.mjs` file.
- Every module has an ACP structural header.
- No shell interpolation for git evidence; use `execFileSync` with argument
  arrays and an injectable runner.
- Parse full commit subject/body records with control-character separators.
- Unknown commits warn and contribute `none` unless their body has a breaking
  trailer.
- Protocol level is never inferred.
- `--dry-run` is read-only and prompt-free.
- Apply/baseline require clean state and interactive confirmation or `--yes`.
- Ordinary apply never creates a release tag; baseline is the only tag mutation.
- Validate every transform before writing; replace through temp files and roll
  back earlier replacements if a later rename fails.
- Do not modify the repository's actual version or create its baseline tag while
  implementing/testing this feature. Integration tests use temporary repos.
- Every commit ends `refs #321`.

## Slice 1 — Documentation-first contract

Files:

- `docs/superpowers/specs/2026-07-13-acp-bump-version-design.md`
- `wiki/decisions/ADR-0016-version-bump-policy.md`
- `wiki/references/version-bump.md`
- `wiki/src/protocol/version.md`
- `wiki/handoffs/2026-07-13-acp-bump-version.md`
- affected MOCs, README, and `wiki/CHANGELOG.md`

Acceptance:

- ADR number does not collide with ADR-0014/0015.
- Grill resolves commit bodies, tag timing, confirmation, dirty state, and
  multi-file rollback.
- `pnpm exec prettier --check` passes for every changed document.
- Commit documentation before any implementation module.

## Slice 2 — Strict inputs and pure policy

Create:

- `scripts/bump/args.mjs` + `args.test.mjs`
- `scripts/bump/semver.mjs` + `semver.test.mjs`
- `scripts/bump/policy.mjs` + `policy.test.mjs`

Required interfaces:

```text
parseArgs(argv) ->
  { mode, release?, protocol?, since?, force, yes, dryRun }

bumpRelease(version, level) -> three-part version
bumpProtocol(version, level) -> two-part protocol version

classifyRelease(signals) -> { level, reasons, warnings }
classifyProtocol(signals) -> { level: none, reasons, warnings }
validateReleaseOverride(proposed, override, force) -> accepted level or violation
planBump({ signals, current, overrides, force }) -> immutable plan
```

Tests must cover:

- all valid levels and reset behavior;
- leading zero, negative, non-numeric, overflow, wrong-part, and invalid-level
  rejection;
- unknown flag, missing/repeated value, invalid level, and incompatible baseline
  mode rejection;
- release success/failure/regression matrix;
- protocol surface warning without an inferred bump;
- lower release override refusal and `--force` acceptance;
- explicit protocol major/minor/patch/none behavior.

Commit pure policy separately from I/O.

## Slice 3 — Full git evidence and baseline

Create:

- `scripts/bump/parse-commits.mjs` + tests
- `scripts/bump/collect.mjs` + tests

Commit records use `%x1e%s%x1f%b`. The parser accepts `{ subject, body }`,
preserves type/scope, recognizes `!`, `BREAKING CHANGE:`, and
`BREAKING-CHANGE:`, and marks malformed subjects `unknown` without discarding a
breaking body.

`resolveBaseline` uses the newest reachable `v*` tag from `HEAD`; `--since`
resolution verifies `<ref>^{commit}`. `collectSignals` reads commits and changed
paths for `<baseline>..HEAD`, then isolates `src/protocol/` paths.

Tests must cover reachable vs unrelated tags, no baseline, invalid `--since`,
empty history, filenames with spaces, full breaking trailers, malformed commits,
and protocol/non-protocol paths. Git is injected for unit tests; temporary repos
provide one end-to-end collector regression.

## Slice 4 — Validated transforms and transaction

Create:

- `scripts/bump/rewrite.mjs` + tests
- `scripts/bump/transaction.mjs` + tests

Pure transforms:

```text
rewritePackageVersion(text, expected, next)
rewriteProtocolVersion(text, expected, next)
prependChangelogEntry(text, entry)
changelogEntry({ date, release?, protocol? })
```

They parse/validate the package top-level version, require exactly one textual
anchor, require exactly one protocol constant matching `expected`, and require
the changelog heading. Unchanged lines preserve repository formatting.

The transaction accepts path/content pairs, captures originals, creates
same-directory temp files with the target mode, flushes, renames, and cleans up.
An injected filesystem operation must force failure on a later rename and prove
that earlier files are byte-identical after rollback. Cover rollback failure as
a distinct error.

## Slice 5 — Orchestrator and isolated repository integration

Create:

- `scripts/acp-bump.mjs`
- `scripts/acp-bump.test.mjs`

Modify `package.json` with:

```json
"bump": "node scripts/acp-bump.mjs"
```

The entrypoint:

1. parses argv before I/O;
2. resolves/validates the baseline;
3. collects evidence and builds the immutable plan;
4. prints current/next versions, reasons, warnings, and dirtiness;
5. exits on violations or an all-`none` plan;
6. returns immediately for dry-run;
7. requires clean state and confirmation, then revalidates clean state and the
   captured `HEAD` before mutation;
8. precomputes all transforms and commits the transaction;
9. prints the reviewed diff instruction and post-commit release tag command.

Baseline mode previews or creates annotated `v<package-version>` at the captured
commit SHA. Collisions, dirty state, missing confirmation, post-prompt dirtiness,
and a changed `HEAD` fail before `git tag`.

Integration tests spawn the real script in temporary initialized git repos and
prove:

- no-baseline refusal;
- baseline dry-run immutability and successful `--yes` annotated tag;
- tag collision refusal;
- dry-run leaves bytes and refs unchanged;
- non-TTY apply without `--yes` refuses;
- dirty apply refuses;
- post-confirmation dirty/changed-HEAD races refuse;
- feat/fix/breaking-body proposals;
- release override violation and forced override;
- protocol evidence warning and explicit protocol application;
- successful release/protocol/changelog apply;
- no immediate release tag is created.

## Slice 6 — Reconcile, review, and production gates

Update [[version-bump]], the handoff, changelog, architecture build order, and
README to match the exact implementation. Run an exact source/wiki audit; the
expected result remains 255/255 with zero missing or orphan pages.

Run, in order:

```bash
pnpm exec vitest run scripts/bump/*.test.mjs scripts/acp-bump.test.mjs
pnpm typecheck
pnpm lint
pnpm format:check
pnpm check:agent-permissions
pnpm check:env
pnpm check:edge-runtime-pins
pnpm check:file-size
pnpm test
pnpm build
pnpm dogfood:docker-self
```

Coordinate the work/checkpoint/handoff/review lifecycle through the production
Dockerized ACP host. An independent reviewer must inspect the final diff and
approve only after the complete gate. Release all ACP leases and complete its
work item before publication.

Then push `feat/acp-bump-version`, open a ready PR to `main` with `Closes #321`,
wait for every required check, squash-merge, comment on/close issue #321, and
delete the remote feature branch. Preserve the user-owned untracked
`@root/install.sh` throughout.

## Explicit deferrals

- npm/registry publication;
- automatic release commits;
- immediate tag creation for uncommitted bump edits;
- automatic protocol compatibility classification;
- CI enforcement that a release bump exists;
- multi-version protocol compatibility changes beyond the existing constant.
