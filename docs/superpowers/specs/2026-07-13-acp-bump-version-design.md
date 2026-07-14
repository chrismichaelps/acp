# `acp bump` — Senior Semantic Versioning for ACP

- **Date:** 2026-07-13
- **Status:** ACCEPTED (production hardening reconciled under issue #321)
- **Topic:** A unified version-bump capability that reasons about semver and
  bumps the ACP **protocol version** and/or the **release version**, gated by an
  explicit "when do we really need to bump?" policy.

## Problem

ACP carries two independent version lines, and today neither has a disciplined
bump path:

- **Protocol version** — `ACP_PROTOCOL_VERSION = '0.1'` in
  `src/protocol/version.ts`, negotiated at the session handshake (ADR-0004).
  It is hardcoded, single-valued, and there is no defined rule for when or how
  it advances or how `SUPPORTED_PROTOCOL_VERSIONS` grows.
- **Release version** — `package.json` at `1.0.0`, with no git tags, no
  changelog-driven bump, and no policy.

The repository history shows why naïve bumping is wrong: a large fraction of
recent commits are `docs(wiki):` and `test(dogfood):`. A "bump on every merge"
rule would produce meaningless version churn on both lines. We need a
**senior-level** policy: bump the *right* line, at the *right* level, only when a
change *actually warrants it* — and, most of the time, bump nothing.

## Goals

1. A single command, `acp bump`, that proposes and applies version bumps.
2. An explicit, testable semver **policy** encoding *when* each line bumps and at
   *what* level.
3. Evidence-driven proposals (from conventional-commit history and
   protocol-surface changes) with written justification.
4. Human confirmation and guardrails that refuse contradictory overrides.
5. FMCF-compliant: an ADR + wiki entry are authored first; code projects them.

## Non-Goals

- Publishing to a registry / npm publish (out of scope; bump only).
- Automating protocol-version *negotiation* changes beyond editing the constant
  and the supported set (compatibility logic already lives in ADR-0004's module).
- CI enforcement of the policy (a follow-up; this ships the tool + policy).

## The Semver Policy ("when do we really need to bump?")

Two lines, different reasons, different cadence. Most changes bump **neither**.

### Protocol version (`ACP_PROTOCOL_VERSION`)

Bump **only when the observable wire contract changes.** This is rare and
deliberate.

- **MAJOR** — a breaking change an existing client would fail on: removed/renamed
  fields, changed semantics of an existing field, changed handshake error
  behavior, tightened validation on previously-accepted input.
- **MINOR** — backward-compatible additive change: a new optional request field,
  a new method/route, a new event kind that old clients safely ignore.
- **PATCH** — a fix in protocol handling that does **not** change the wire
  contract (e.g. correcting an internal dispatch bug).
- **No bump** — the common case: any change that does not touch the wire
  contract at all.

**0.x rule:** while the protocol is `0.y`, semver §4 permits breaking changes
without a `1.0.0`-style major. The policy still classifies intent (breaking vs
additive) and records it, and requires an explicit human decision on whether a
breaking `0.x` change advances `y` (treated as the "major" slot for `0.x`) and
whether the prior version stays in `SUPPORTED_PROTOCOL_VERSIONS`.

### Release version (`package.json`)

Bump when **observable behavior/CLI/API ships.**

- **MAJOR** — breaking operator-facing change (removed CLI command/flag, changed
  default, changed on-disk/HTTP behavior operators depend on).
- **MINOR** — new backward-compatible capability (`feat:`).
- **PATCH** — bugfix (`fix:`).
- **No bump** — docs-only, tests-only, or pure internal refactor with no
  observable behavior change (`docs:`, `test:`, `chore:`, `refactor:` with no
  other qualifying commits).

### Decoupling rule

The two lines advance independently. A release bump does **not** imply a protocol
bump, and vice versa. Shipping ten releases without a protocol change is normal
and correct.

## Architecture

Three units with clear boundaries, plus documentation-first artifacts.

### 1. Pure policy modules — `scripts/bump/`

Pure, dependency-free, unit-tested ESM. Owns the *rules*, not I/O, and can be
imported by both Node and Vitest without building `dist/` first.

- `SemverLevel = 'major' | 'minor' | 'patch' | 'none'`
- `ChangeSignals` — the normalized evidence input:
  - `commits: ReadonlyArray<ConventionalCommit>` (type, scope, breaking flag)
  - `protocolSurfaceChanged: boolean`
- `classifyRelease(signals) → { level: SemverLevel; reasons: string[] }`
- `classifyProtocol(signals) → { level: SemverLevel; reasons: string[] }`
- `applyBump(version: string, level: SemverLevel) → string` (semver arithmetic;
  respects the `0.x` slot semantics for the protocol line)
- `validateOverride(proposed, override) → Either<PolicyViolation, SemverLevel>`
  — refuses an explicit level that contradicts the evidence (e.g. asking for
  `patch` when a `BREAKING CHANGE` commit exists) unless force is set.

Boundary: given `ChangeSignals`, it returns levels + justification. It reads no
files, runs no git, and prints nothing.

### 2. Evidence collectors — `scripts/bump/collect.mjs`

Impure adapters that build `ChangeSignals` from the working tree:

- **Commit collector** — `git log <lastTag>..HEAD` using record/field separators
  for the subject and body, parsed for conventional-commit type/scope/`!` and
  `BREAKING CHANGE`/`BREAKING-CHANGE` trailers. A missing tag is an error unless
  the operator provides `--since` or explicitly establishes a baseline.
  Commits that do not match the conventional grammar are recorded as
  `type: 'unknown'` and contribute `none` (with a warning), never a silent bump.
- **Protocol-surface collector** — `git diff --name-only <lastTag>..HEAD` over
  `src/protocol/**`. It reports only a boolean `protocolSurfaceChanged` plus the
  list of touched files. It does **not** try to auto-classify breaking vs
  additive from a textual diff (see Grill G3): when the surface changed, the
  proposal is `none` accompanied by a **"protocol surface changed — decide
  explicitly"** warning, and applying a protocol bump requires an explicit
  `--protocol <level>`.

### 3. CLI/script wiring — `acp bump` (`scripts/acp-bump.mjs` + npm `bump`)

A **local dev-tree command** (not an RPC endpoint — `bin/acp` forwards to the
containerized RPC CLI, which cannot edit host files; bumping edits repo files and
must be reproducible in CI/local shell). Flow:

1. Collect evidence → `ChangeSignals`.
2. Call policy → proposed `{ protocol, release }` levels + reasons.
3. Print the proposal with justification and the resulting version strings.
4. Confirm: interactive prompt on a TTY, or `--yes` for non-interactive apply.
   Non-interactive apply without `--yes` fails closed. `--dry-run` never prompts.
5. Apply the accepted bumps:
   - Release: rewrite `version` in `package.json`.
   - Protocol: rewrite the single `ACP_PROTOCOL_VERSION` literal in
     `src/protocol/version.ts`; the supported set and schema derive from it.
   - Append a one-line entry to `wiki/CHANGELOG.md` (the forensic ledger).
6. Print the release-tag command to run after the bump is committed. Ordinary
   bump execution never creates a tag because `HEAD` does not yet contain the
   working-tree version edits. Only `--baseline` may tag the current committed
   `HEAD`, after confirmation and collision checks.

Flags: `acp bump [--release <level>] [--protocol <level>] [--since <ref>]
[--yes] [--force] [--dry-run] [--baseline]`. With no explicit level, the release line
is inferred and the protocol line defaults to `none` (only an explicit
`--protocol` advances it). Explicit levels are validated by `validateOverride`.
`--since` is a convenience override for the baseline ref; it defaults to the
last release tag.

### 4. Documentation-first (FMCF)

- **ADR-0016 — Version Bump Policy** in `wiki/decisions/`, capturing the
  two-line policy, the decoupling rule, and the `0.x` handling. Referenced from
  `wiki/decisions/_MOC.md`.
- A `wiki/references/version-bump.md` page for the repository-local script
  modules. They are developer tooling outside the `src/` mirror.
- `wiki/CHANGELOG.md` entry for the feature itself.

## Data Flow

```
git history ─▶ collect.mjs ─▶ ChangeSignals ─▶ policy(classify*) ─▶ proposal
                                                                       │
                                              human confirm / --yes ◀──┤
                                                                       ▼
                              apply: package.json · version.ts · CHANGELOG.md
```

## Error Handling

- No reachable release tag → refuse to infer across full history. Require
  `--since <ref>` or `--baseline`.
- Contradictory `--force`-less override → exit non-zero with the specific policy
  violation and the evidence that contradicts it.
- Protocol-surface change detected but kind ambiguous → refuse to auto-bump the
  protocol line; require an explicit `--protocol <level>` decision.
- `--dry-run` prints the full proposal and diffs without writing.
- Before writing, validate every source anchor and precompute every output.
  Apply through same-directory temporary files and atomic renames. If a later
  rename fails, restore every already-replaced file from captured originals and
  report rollback failure explicitly if restoration is incomplete.
- Unknown flags, missing flag values, invalid levels, contradictory modes,
  dirty apply worktrees, and non-TTY apply without `--yes` fail before mutation.

## Testing

- **Policy (pure) unit tests** — the classification matrix: feat→minor, fix→
  patch, `!`/BREAKING→major, docs/test/chore→none; protocol surface touched or
  untouched→none until explicit override; decoupling (release bump ⇏ protocol
  bump); `0.x` slot arithmetic; `validateOverride` refusals.
- **Collector tests** — parse fixture commit lists and fixture diffs into the
  expected `ChangeSignals`.
- **Command integration test** — isolated temporary git repositories cover
  baseline creation/collision, full commit-body evidence, dry-run immutability,
  confirmation refusal, successful `--yes` apply, dirty-worktree refusal, and
  transactional rollback.
- Wire into existing gates (`typecheck`, `lint`, `format:check`, `test`).

## Dogfood

Per the repo's ACP-self workflow, the *development* of this feature is
coordinated through the Dockerized `acp` host: register the work item, record
checkpoints per slice, and capture review evidence. The bump tool itself is a
dev-tree command and does not depend on a running host at runtime.

## Self-Grill (senior adversarial review)

The design was grilled against senior objections; findings are folded in above.

- **G1 — Is a bare `scripts/*.mjs` the right home, not a first-class CLI verb?**
  Yes. Bumping edits the *working tree* and must run in CI/local shell; the `acp`
  CLI forwards to the containerized RPC host, which cannot write host files.
  `scripts/acp-bump.mjs` + an npm `bump` script matches the existing `check:*`
  and `dogfood:*` script convention. Kept.
- **G2 — Conventional-commit inference is only as good as the commit hygiene.**
  Mitigated: non-conforming commits are `unknown` → contribute `none` with a
  warning; they never cause a silent bump. The repo already enforces
  conventional style, so this is the exception path, not the norm.
- **G3 — Auto-classifying protocol breaking-vs-additive from a text diff is
  unsound.** Correct — dropped. The collector reports only *whether* the protocol
  surface changed; kind is a human decision via explicit `--protocol`. The
  default protocol proposal is always `none`. This is the single most important
  refinement: it prevents the tool from confidently mislabeling a wire break.
- **G4 — Is the release line worth bumping when nothing reads `package.json`
  version at runtime today?** Yes: release/tag hygiene, changelog anchoring, and
  future publish all depend on it. Noted as a known-latent surface, not blocking.
- **G5 — Zero tags today: the first inference would classify all of history.**
  Handled by the Baseline story below — the first action establishes a `v1.0.0`
  baseline tag without bumping, so subsequent runs classify only `baseline..HEAD`.
- **G6 — Programmatic edits to `version.ts` are brittle.** Accepted risk,
  contained by exact single-anchor validation and a targeted integration test
  against the real file shape. `SUPPORTED_PROTOCOL_VERSIONS` and
  `ProtocolVersion` already derive from the constant, so only that literal is
  rewritten.
- **G7 — Coupling both lines in one command.** Retained per the chosen unified
  design, but the lines are independently controllable via flags and never
  co-bump implicitly (Decoupling rule).
- **G8 — Should `--tag` create a release tag immediately after writes?** No.
  The version edits are still uncommitted, so such a tag would point at the old
  version. The tool prints the post-commit tag command instead. Baseline tagging
  is safe because it intentionally labels the current committed `HEAD`.
- **G9 — Is per-file atomicity enough?** No. The three-file update is one
  logical transaction. All transforms validate first; replacement uses temp
  files and rollback restores earlier files if a later rename fails.

## Baseline Story (first run, no tags)

Because there are no git tags, the first invocation must not treat the entire
history as a pending bump. `acp bump --baseline --yes` (or interactive
confirmation) creates an annotated tag for the current `package.json` version
(`v1.0.0`) at `HEAD` **without** editing any version. A collision or dirty
worktree fails closed. Every later `acp bump` then
classifies only `v1.0.0..HEAD`. If a bump is attempted with no tag present and
`--baseline` was not run, the tool warns and requires `--since <ref>` or refuses.

## Handoff

This turn brainstormed, self-grilled, and specced the feature autonomously (no
human approval gate, per direction). The next step is `writing-plans` to produce
the phased implementation plan, then TDD execution slice-by-slice per the Build
Order, with the feature's development coordinated through the Docker `acp-self`
host when it is running. Branch: `feat/acp-bump-version` (off `main`).

## Build Order (slices)

1. ADR-0016 + wiki entries (FMCF: wiki first).
2. Pure policy module + unit tests.
3. Evidence collectors + tests.
4. `acp bump` script wiring + `--dry-run` integration test; npm `bump` script.
5. Apply-path (writes to package.json / version.ts / CHANGELOG) + integration.
6. Docs polish (README usage), wiki source-mirror parity, changelog entry.
