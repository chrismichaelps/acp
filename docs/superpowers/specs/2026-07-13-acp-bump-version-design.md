# `acp bump` — Senior Semantic Versioning for ACP

- **Date:** 2026-07-13
- **Status:** DRAFT (awaiting user review)
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

### 1. Pure policy module — `src/domain/versioning/`

Pure, dependency-free, unit-tested. Owns the *rules*, not I/O.

- `SemverLevel = 'major' | 'minor' | 'patch' | 'none'`
- `ChangeSignals` — the normalized evidence input:
  - `commits: ReadonlyArray<ConventionalCommit>` (type, scope, breaking flag)
  - `protocolSurfaceChanged: boolean`
  - `protocolChangeKind: 'breaking' | 'additive' | 'fix' | 'none'`
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

- **Commit collector** — `git log <lastTag>..HEAD` (fallback: all commits when no
  tag exists), parsed for conventional-commit type/scope/`!`/`BREAKING CHANGE`.
- **Protocol-surface collector** — `git diff --name-only <lastTag>..HEAD` over
  `src/protocol/**`; classifies additive vs breaking heuristically (added
  optional field → additive; removed/renamed/required-tightened → breaking →
  flagged for human confirmation). Defaults to `none` when `src/protocol/**` is
  untouched.

### 3. CLI/script wiring — `acp bump` (`scripts/acp-bump.mjs` + npm `bump`)

A **local dev-tree command** (not an RPC endpoint — `bin/acp` forwards to the
containerized RPC CLI, which cannot edit host files; bumping edits repo files and
must be reproducible in CI/local shell). Flow:

1. Collect evidence → `ChangeSignals`.
2. Call policy → proposed `{ protocol, release }` levels + reasons.
3. Print the proposal with justification and the resulting version strings.
4. Confirm: interactive prompt, or `--yes` for non-interactive.
5. Apply the accepted bumps:
   - Release: rewrite `version` in `package.json`.
   - Protocol: rewrite `ACP_PROTOCOL_VERSION` (and, on a breaking `0.x`
     advance, update `SUPPORTED_PROTOCOL_VERSIONS`) in `src/protocol/version.ts`.
   - Append a one-line entry to `wiki/CHANGELOG.md` (the forensic ledger).
6. Optionally create a git tag (`--tag`), off by default.

Flags: `acp bump [--release <level>] [--protocol <level>] [--since <ref>]
[--yes] [--tag] [--force] [--dry-run]`. With no explicit level, both are
inferred; explicit levels are validated by `validateOverride`.

### 4. Documentation-first (FMCF)

- **ADR-0014 — Version Bump Policy** in `wiki/decisions/`, capturing the
  two-line policy, the decoupling rule, and the `0.x` handling. Referenced from
  `wiki/decisions/_MOC.md`.
- Wiki source-mirror pages for the new `src/domain/versioning/` module.
- `wiki/CHANGELOG.md` entry for the feature itself.

## Data Flow

```
git history ─▶ collect.mjs ─▶ ChangeSignals ─▶ policy(classify*) ─▶ proposal
                                                                       │
                                              human confirm / --yes ◀──┤
                                                                       ▼
                              apply: package.json · version.ts · CHANGELOG.md · [tag]
```

## Error Handling

- No git tag yet → fall back to full history; warn that the baseline is the
  repo root (first bump establishes the baseline tag when `--tag` is passed).
- Contradictory `--force`-less override → exit non-zero with the specific policy
  violation and the evidence that contradicts it.
- Protocol-surface change detected but kind ambiguous → refuse to auto-bump the
  protocol line; require an explicit `--protocol <level>` decision.
- `--dry-run` prints the full proposal and diffs without writing.
- All writes are atomic per file; on any write failure, already-written files are
  reported so the operator can reconcile.

## Testing

- **Policy (pure) unit tests** — the classification matrix: feat→minor, fix→
  patch, `!`/BREAKING→major, docs/test/chore→none; protocol additive→minor,
  breaking→major, untouched→none; decoupling (release bump ⇏ protocol bump);
  `0.x` slot arithmetic; `validateOverride` refusals.
- **Collector tests** — parse fixture commit lists and fixture diffs into the
  expected `ChangeSignals`.
- **Command integration test** — `--dry-run` over a fixture repo state produces
  the expected proposal and the expected file diffs; `--yes` applies them.
- Wire into existing gates (`typecheck`, `lint`, `format:check`, `test`).

## Dogfood

Per the repo's ACP-self workflow, the *development* of this feature is
coordinated through the Dockerized `acp` host: register the work item, record
checkpoints per slice, and capture review evidence. The bump tool itself is a
dev-tree command and does not depend on a running host at runtime.

## Build Order (slices)

1. ADR-0014 + wiki entries (FMCF: wiki first).
2. Pure policy module + unit tests.
3. Evidence collectors + tests.
4. `acp bump` script wiring + `--dry-run` integration test; npm `bump` script.
5. Apply-path (writes to package.json / version.ts / CHANGELOG) + integration.
6. Docs polish (README usage), wiki source-mirror parity, changelog entry.
