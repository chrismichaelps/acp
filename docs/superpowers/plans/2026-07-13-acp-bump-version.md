# `acp bump` — Senior Semver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `acp bump`, a version-bump tool that reasons about semver and advances the ACP protocol version and/or the release version only when a change actually warrants it.

**Architecture:** A pure, typed policy module in `src/domain/versioning/` owns the semver rules (classification + arithmetic) and is unit-tested by the existing vitest gate. Impure adapters in `scripts/bump/` collect evidence from git and write the version files. A thin orchestrator `scripts/acp-bump.mjs` (exposed as `npm run bump`) wires evidence → policy → confirm → apply. Documentation (ADR-0014 + wiki) is authored first per FMCF.

**Tech Stack:** TypeScript (Effect `Schema` only where already idiomatic; the policy is plain pure TS), Node ESM `.mjs` scripts, vitest, git plumbing via `child_process`.

## Global Constraints

- Package manager: pnpm 11.7.0 (`devEngines`). Run tooling via `node_modules/.bin` — do not invoke `npm install` (blocked in sandbox).
- Module doc header required on every `src` module: `/** @Acp.<Area> — <one-line> */`.
- Max file size 500 lines (`scripts/check-file-size.mjs` over `.ts`/`.tsx`).
- Conventional-commit messages; **no Claude attribution** in commits or PRs.
- FMCF: wiki is truth; `src/` modules are mirrored under `wiki/src/`. Author ADR + wiki before code.
- Protocol version string is 2-part `MAJOR.MINOR` (`'0.1'`); release version is 3-part `MAJOR.MINOR.PATCH` (`'1.0.0'`).
- Gates that must stay green: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`. Invoke as `node_modules/.bin/tsc --noEmit`, `node_modules/.bin/eslint .`, `node_modules/.bin/prettier --check .`, `node_modules/.bin/vitest run`.

---

### Task 1: ADR-0014 + wiki policy doc (FMCF docs-first)

**Files:**
- Create: `wiki/decisions/ADR-0014-version-bump-policy.md`
- Modify: `wiki/decisions/_MOC.md` (add the ADR-0014 link)
- Modify: `wiki/CHANGELOG.md` (prepend one delta line)

**Interfaces:**
- Produces: the canonical policy text later code projects — the two-line semver rules, the decoupling rule, and the 0.x handling.

- [ ] **Step 1: Write ADR-0014** with sections Status (ACCEPTED — 2026-07-13), Context, Decision, Rationale, Consequences. Copy the policy tables and the Decoupling/0.x rules verbatim from `docs/superpowers/specs/2026-07-13-acp-bump-version-design.md`. Front-matter:

```markdown
---
type: adr
status: ACCEPTED
date: 2026-07-13
tags: [adr, versioning, tooling]
aliases: [ADR-0014, ADR-0014-version-bump-policy]
---

# ADR-0014 — Version Bump Policy
```

- [ ] **Step 2: Link it** — add `- [[ADR-0014-version-bump-policy|ADR-0014]] — version bump policy (protocol + release semver).` to `wiki/decisions/_MOC.md` in the ADR list.

- [ ] **Step 3: Changelog** — prepend to `wiki/CHANGELOG.md`:

```markdown
- 2026-07-13 · Version bump policy · defined the two-line semver policy
  (protocol vs release), the decoupling rule, and 0.x handling; introduced the
  `acp bump` dev tool proposed from git evidence with human-confirmed writes ·
  validation: policy unit tests + dry-run integration · risk LOW ·
  [[ADR-0014-version-bump-policy]]
```

- [ ] **Step 4: Verify docs gate**

Run: `node_modules/.bin/prettier --check "wiki/**/*.md"`
Expected: PASS (no formatting diffs).

- [ ] **Step 5: Commit**

```bash
git add wiki/decisions/ADR-0014-version-bump-policy.md wiki/decisions/_MOC.md wiki/CHANGELOG.md
git commit -m "docs(versioning): adopt ADR-0014 version bump policy"
```

---

### Task 2: Semver arithmetic (`applyBump`)

**Files:**
- Create: `src/domain/versioning/semver.ts`
- Test: `src/domain/versioning/semver.test.ts`

**Interfaces:**
- Produces:
  - `type SemverLevel = 'major' | 'minor' | 'patch' | 'none'`
  - `bumpRelease(version: string, level: SemverLevel): string` — 3-part standard semver.
  - `bumpProtocol(version: string, level: SemverLevel): string` — 2-part `0.x` rule: while MAJOR is `0`, both `major` and `minor` advance the MINOR slot; `patch` is a no-op; `none` unchanged.

- [ ] **Step 1: Write the failing test**

```typescript
/** @Acp.Domain.Versioning.Semver.Test — semver arithmetic for both version lines */
import { describe, expect, it } from 'vitest'
import { bumpProtocol, bumpRelease } from './semver.js'

describe('bumpRelease (3-part standard semver)', () => {
  it('bumps major and resets minor/patch', () => {
    expect(bumpRelease('1.4.2', 'major')).toBe('2.0.0')
  })
  it('bumps minor and resets patch', () => {
    expect(bumpRelease('1.4.2', 'minor')).toBe('1.5.0')
  })
  it('bumps patch', () => {
    expect(bumpRelease('1.4.2', 'patch')).toBe('1.4.3')
  })
  it('leaves version unchanged for none', () => {
    expect(bumpRelease('1.4.2', 'none')).toBe('1.4.2')
  })
  it('rejects a non 3-part version', () => {
    expect(() => bumpRelease('0.1', 'patch')).toThrow(/3-part/)
  })
})

describe('bumpProtocol (2-part 0.x rule)', () => {
  it('advances the minor slot for a breaking (major) change while in 0.x', () => {
    expect(bumpProtocol('0.1', 'major')).toBe('0.2')
  })
  it('advances the minor slot for an additive (minor) change while in 0.x', () => {
    expect(bumpProtocol('0.1', 'minor')).toBe('0.2')
  })
  it('is a no-op for patch (no patch slot in 0.x)', () => {
    expect(bumpProtocol('0.1', 'patch')).toBe('0.1')
  })
  it('leaves version unchanged for none', () => {
    expect(bumpProtocol('0.1', 'none')).toBe('0.1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node_modules/.bin/vitest run src/domain/versioning/semver.test.ts`
Expected: FAIL — cannot resolve `./semver.js`.

- [ ] **Step 3: Write minimal implementation**

```typescript
/** @Acp.Domain.Versioning.Semver — pure semver arithmetic for release + protocol lines */
export type SemverLevel = 'major' | 'minor' | 'patch' | 'none'

const parse = (version: string, parts: number): number[] => {
  const segments = version.split('.')
  if (segments.length !== parts) {
    throw new Error(`expected a ${parts}-part version, received "${version}"`)
  }
  return segments.map((segment) => {
    const value = Number(segment)
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`invalid version segment "${segment}" in "${version}"`)
    }
    return value
  })
}

export const bumpRelease = (version: string, level: SemverLevel): string => {
  const [major, minor, patch] = parse(version, 3)
  switch (level) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
    case 'none':
      return version
  }
}

export const bumpProtocol = (version: string, level: SemverLevel): string => {
  const [major, minor] = parse(version, 2)
  if (major !== 0) {
    // Once the protocol graduates out of 0.x, treat it as standard 2-part semver.
    if (level === 'major') return `${major + 1}.0`
    if (level === 'minor') return `${major}.${minor + 1}`
    return version
  }
  // 0.x: no compatibility guarantee, so breaking and additive both advance MINOR;
  // there is no patch slot.
  if (level === 'major' || level === 'minor') return `0.${minor + 1}`
  return version
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node_modules/.bin/vitest run src/domain/versioning/semver.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/domain/versioning/semver.ts src/domain/versioning/semver.test.ts
git commit -m "feat(versioning): add pure semver arithmetic"
```

---

### Task 3: Classification policy (`classifyRelease`, `classifyProtocol`, `validateOverride`)

**Files:**
- Create: `src/domain/versioning/policy.ts`
- Test: `src/domain/versioning/policy.test.ts`

**Interfaces:**
- Consumes: `SemverLevel` from `./semver.js`.
- Produces:
  - `interface ConventionalCommit { type: string; scope?: string; breaking: boolean }`
  - `interface ChangeSignals { commits: ReadonlyArray<ConventionalCommit>; protocolSurfaceChanged: boolean; protocolFiles: ReadonlyArray<string> }`
  - `interface Proposal { level: SemverLevel; reasons: string[] }`
  - `classifyRelease(signals: ChangeSignals): Proposal`
  - `classifyProtocol(signals: ChangeSignals): Proposal`
  - `validateOverride(proposed: SemverLevel, override: SemverLevel, opts: { force: boolean }): { ok: true; level: SemverLevel } | { ok: false; violation: string }`
  - `RELEASE_RANK: Record<SemverLevel, number>` (`none:0, patch:1, minor:2, major:3`)

- [ ] **Step 1: Write the failing test**

```typescript
/** @Acp.Domain.Versioning.Policy.Test — when do we really need to bump */
import { describe, expect, it } from 'vitest'
import {
  classifyProtocol,
  classifyRelease,
  validateOverride,
  type ChangeSignals,
} from './policy.js'

const base: ChangeSignals = {
  commits: [],
  protocolSurfaceChanged: false,
  protocolFiles: [],
}

describe('classifyRelease', () => {
  it('proposes minor for a feat', () => {
    const p = classifyRelease({ ...base, commits: [{ type: 'feat', breaking: false }] })
    expect(p.level).toBe('minor')
  })
  it('proposes patch for a fix', () => {
    const p = classifyRelease({ ...base, commits: [{ type: 'fix', breaking: false }] })
    expect(p.level).toBe('patch')
  })
  it('proposes major when any commit is breaking', () => {
    const p = classifyRelease({
      ...base,
      commits: [{ type: 'feat', breaking: false }, { type: 'fix', breaking: true }],
    })
    expect(p.level).toBe('major')
  })
  it('proposes none for docs/test/chore only', () => {
    const p = classifyRelease({
      ...base,
      commits: [{ type: 'docs', breaking: false }, { type: 'test', breaking: false }],
    })
    expect(p.level).toBe('none')
  })
  it('takes the highest level across mixed commits', () => {
    const p = classifyRelease({
      ...base,
      commits: [{ type: 'docs', breaking: false }, { type: 'feat', breaking: false }],
    })
    expect(p.level).toBe('minor')
  })
  it('warns on unknown commit types but does not bump on them', () => {
    const p = classifyRelease({ ...base, commits: [{ type: 'wip', breaking: false }] })
    expect(p.level).toBe('none')
    expect(p.reasons.join(' ')).toMatch(/unknown/)
  })
})

describe('classifyProtocol', () => {
  it('always proposes none, even when the surface changed', () => {
    const p = classifyProtocol({ ...base, protocolSurfaceChanged: true, protocolFiles: ['src/protocol/schema/common.ts'] })
    expect(p.level).toBe('none')
    expect(p.reasons.join(' ')).toMatch(/protocol surface changed/i)
  })
  it('is silent when the surface is untouched', () => {
    const p = classifyProtocol(base)
    expect(p.level).toBe('none')
    expect(p.reasons.join(' ')).toMatch(/no protocol surface change/i)
  })
})

describe('validateOverride', () => {
  it('accepts an override that is >= the proposed level', () => {
    expect(validateOverride('patch', 'minor', { force: false })).toEqual({ ok: true, level: 'minor' })
  })
  it('refuses a lower override that contradicts the evidence', () => {
    const r = validateOverride('major', 'patch', { force: false })
    expect(r.ok).toBe(false)
  })
  it('permits a contradictory override under force', () => {
    expect(validateOverride('major', 'patch', { force: true })).toEqual({ ok: true, level: 'patch' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node_modules/.bin/vitest run src/domain/versioning/policy.test.ts`
Expected: FAIL — cannot resolve `./policy.js`.

- [ ] **Step 3: Write minimal implementation**

```typescript
/** @Acp.Domain.Versioning.Policy — semver classification: when do we really need to bump */
import type { SemverLevel } from './semver.js'

export interface ConventionalCommit {
  readonly type: string
  readonly scope?: string
  readonly breaking: boolean
}

export interface ChangeSignals {
  readonly commits: ReadonlyArray<ConventionalCommit>
  readonly protocolSurfaceChanged: boolean
  readonly protocolFiles: ReadonlyArray<string>
}

export interface Proposal {
  readonly level: SemverLevel
  readonly reasons: string[]
}

export const RELEASE_RANK: Record<SemverLevel, number> = {
  none: 0,
  patch: 1,
  minor: 2,
  major: 3,
}

const RELEASE_TYPE_LEVEL: Record<string, SemverLevel> = {
  feat: 'minor',
  fix: 'patch',
  perf: 'patch',
}
const NO_BUMP_TYPES = new Set(['docs', 'test', 'chore', 'refactor', 'style', 'ci', 'build'])

const higher = (a: SemverLevel, b: SemverLevel): SemverLevel =>
  RELEASE_RANK[a] >= RELEASE_RANK[b] ? a : b

export const classifyRelease = (signals: ChangeSignals): Proposal => {
  const reasons: string[] = []
  let level: SemverLevel = 'none'
  for (const commit of signals.commits) {
    if (commit.breaking) {
      level = higher(level, 'major')
      reasons.push(`breaking change (${commit.type}) -> major`)
      continue
    }
    const mapped = RELEASE_TYPE_LEVEL[commit.type]
    if (mapped) {
      level = higher(level, mapped)
      reasons.push(`${commit.type} -> ${mapped}`)
    } else if (NO_BUMP_TYPES.has(commit.type)) {
      reasons.push(`${commit.type} -> none`)
    } else {
      reasons.push(`unknown commit type "${commit.type}" -> none (ignored)`)
    }
  }
  if (reasons.length === 0) reasons.push('no commits since baseline -> none')
  return { level, reasons }
}

export const classifyProtocol = (signals: ChangeSignals): Proposal => {
  if (!signals.protocolSurfaceChanged) {
    return { level: 'none', reasons: ['no protocol surface change -> none'] }
  }
  return {
    level: 'none',
    reasons: [
      `protocol surface changed (${signals.protocolFiles.length} file(s)) -> decide explicitly with --protocol`,
      ...signals.protocolFiles.map((file) => `  touched: ${file}`),
    ],
  }
}

export const validateOverride = (
  proposed: SemverLevel,
  override: SemverLevel,
  opts: { force: boolean },
): { ok: true; level: SemverLevel } | { ok: false; violation: string } => {
  if (opts.force || RELEASE_RANK[override] >= RELEASE_RANK[proposed]) {
    return { ok: true, level: override }
  }
  return {
    ok: false,
    violation: `requested "${override}" is below the evidence-proposed "${proposed}"; re-run with --force to override`,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node_modules/.bin/vitest run src/domain/versioning/policy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/versioning/policy.ts src/domain/versioning/policy.test.ts
git commit -m "feat(versioning): add semver classification policy"
```

---

### Task 4: Barrel export + wiki source mirror

**Files:**
- Create: `src/domain/versioning/index.ts`
- Create: `wiki/src/domain/versioning/semver.md`
- Create: `wiki/src/domain/versioning/policy.md`
- Modify: `wiki/src/domain/_MOC.md` (add versioning links) — if the file exists; otherwise create the folder MOC `wiki/src/domain/versioning/_MOC.md`.

**Interfaces:**
- Produces: `src/domain/versioning/index.js` re-exporting `./semver.js` and `./policy.js`.

- [ ] **Step 1: Write the barrel**

```typescript
/** @Acp.Domain.Versioning — semver policy + arithmetic public surface */
export * from './semver.js'
export * from './policy.js'
```

- [ ] **Step 2: Mirror pages** — each ~15 lines summarizing the module's responsibility and public surface, matching the style of an existing `wiki/src/domain/**` page. Include the exact exported names.

- [ ] **Step 3: Verify gates**

Run: `node_modules/.bin/tsc --noEmit && node_modules/.bin/prettier --check "wiki/**/*.md" "src/domain/versioning/**"`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/domain/versioning/index.ts wiki/src/domain/versioning/
git commit -m "docs(versioning): mirror versioning module surface"
```

---

### Task 5: Commit collector (git → ChangeSignals.commits)

**Files:**
- Create: `scripts/bump/parse-commits.mjs` (pure parser)
- Create: `scripts/bump/parse-commits.test.mjs`

**Interfaces:**
- Produces: `parseConventionalCommits(subjects: string[]): { type: string, scope?: string, breaking: boolean }[]` — parses the subject line grammar `type(scope)!: description` and detects `BREAKING CHANGE` markers passed inline.

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, expect, it } from 'vitest'
import { parseConventionalCommits } from './parse-commits.mjs'

describe('parseConventionalCommits', () => {
  it('parses type and scope', () => {
    expect(parseConventionalCommits(['feat(events): add filter'])).toEqual([
      { type: 'feat', scope: 'events', breaking: false },
    ])
  })
  it('parses a bang breaking marker', () => {
    expect(parseConventionalCommits(['feat(api)!: drop field'])).toEqual([
      { type: 'feat', scope: 'api', breaking: true },
    ])
  })
  it('parses a bare type without scope', () => {
    expect(parseConventionalCommits(['fix: correct bug'])).toEqual([
      { type: 'fix', breaking: false },
    ])
  })
  it('marks non-conforming subjects as unknown', () => {
    expect(parseConventionalCommits(['just some text'])).toEqual([
      { type: 'unknown', breaking: false },
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node_modules/.bin/vitest run scripts/bump/parse-commits.test.mjs`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write minimal implementation**

```javascript
// @Acp.Scripts.Bump.ParseCommits — parse conventional-commit subject lines
const SUBJECT = /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<bang>!)?:\s.+/

export const parseConventionalCommits = (subjects) =>
  subjects.map((subject) => {
    const match = SUBJECT.exec(subject.trim())
    if (!match || !match.groups) {
      return { type: 'unknown', breaking: false }
    }
    const { type, scope, bang } = match.groups
    const breaking = bang === '!' || /BREAKING CHANGE/.test(subject)
    return scope ? { type, scope, breaking } : { type, breaking }
  })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node_modules/.bin/vitest run scripts/bump/parse-commits.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/bump/parse-commits.mjs scripts/bump/parse-commits.test.mjs
git commit -m "feat(versioning): parse conventional commit subjects"
```

---

### Task 6: Evidence collection from git (impure adapter)

**Files:**
- Create: `scripts/bump/collect.mjs`
- Test: `scripts/bump/collect.test.mjs`

**Interfaces:**
- Consumes: `parseConventionalCommits` from `./parse-commits.mjs`.
- Produces:
  - `resolveBaseline(runGit): string | null` — returns the newest `v*` tag or `null`.
  - `collectSignals({ since, runGit }): ChangeSignals` — builds `{ commits, protocolSurfaceChanged, protocolFiles }`. `runGit(args: string[]) => string` is injected so tests avoid a real repo.

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, expect, it } from 'vitest'
import { collectSignals, resolveBaseline } from './collect.mjs'

const fakeGit = (responses) => (args) => {
  const key = args.join(' ')
  if (!(key in responses)) throw new Error(`unexpected git ${key}`)
  return responses[key]
}

describe('resolveBaseline', () => {
  it('returns the newest version tag', () => {
    const git = fakeGit({ 'tag --list v* --sort=-v:refname': 'v1.2.0\nv1.1.0\n' })
    expect(resolveBaseline(git)).toBe('v1.2.0')
  })
  it('returns null when there are no tags', () => {
    const git = fakeGit({ 'tag --list v* --sort=-v:refname': '\n' })
    expect(resolveBaseline(git)).toBe(null)
  })
})

describe('collectSignals', () => {
  it('collects commits and flags a touched protocol surface', () => {
    const git = fakeGit({
      'log v1.0.0..HEAD --pretty=%s': 'feat(events): add filter\ndocs(wiki): note',
      'diff --name-only v1.0.0..HEAD': 'src/protocol/schema/common.ts\nsrc/app/cli/main.ts',
    })
    const signals = collectSignals({ since: 'v1.0.0', runGit: git })
    expect(signals.commits).toEqual([
      { type: 'feat', scope: 'events', breaking: false },
      { type: 'docs', scope: 'wiki', breaking: false },
    ])
    expect(signals.protocolSurfaceChanged).toBe(true)
    expect(signals.protocolFiles).toEqual(['src/protocol/schema/common.ts'])
  })
  it('reports an untouched protocol surface', () => {
    const git = fakeGit({
      'log v1.0.0..HEAD --pretty=%s': 'fix(docker): tweak',
      'diff --name-only v1.0.0..HEAD': 'Dockerfile',
    })
    const signals = collectSignals({ since: 'v1.0.0', runGit: git })
    expect(signals.protocolSurfaceChanged).toBe(false)
    expect(signals.protocolFiles).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node_modules/.bin/vitest run scripts/bump/collect.test.mjs`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write minimal implementation**

```javascript
// @Acp.Scripts.Bump.Collect — build ChangeSignals from git history
import { execFileSync } from 'node:child_process'
import { parseConventionalCommits } from './parse-commits.mjs'

export const defaultRunGit = (args) =>
  execFileSync('git', args, { encoding: 'utf8' })

export const resolveBaseline = (runGit = defaultRunGit) => {
  const out = runGit(['tag', '--list', 'v*', '--sort=-v:refname']).trim()
  if (out === '') return null
  return out.split('\n')[0].trim()
}

const nonEmptyLines = (text) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')

export const collectSignals = ({ since, runGit = defaultRunGit }) => {
  const range = since ? `${since}..HEAD` : 'HEAD'
  const subjects = nonEmptyLines(runGit(['log', range, '--pretty=%s']))
  const files = nonEmptyLines(runGit(['diff', '--name-only', range]))
  const protocolFiles = files.filter((file) => file.startsWith('src/protocol/'))
  return {
    commits: parseConventionalCommits(subjects),
    protocolSurfaceChanged: protocolFiles.length > 0,
    protocolFiles,
  }
}
```

Note: the `since ? ... : 'HEAD'` branch means the no-baseline path is exercised by the orchestrator's baseline guard (Task 8), not here.

- [ ] **Step 4: Run test to verify it passes**

Run: `node_modules/.bin/vitest run scripts/bump/collect.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/bump/collect.mjs scripts/bump/collect.test.mjs
git commit -m "feat(versioning): collect bump signals from git"
```

---

### Task 7: Version-file writers (pure transforms + thin writes)

**Files:**
- Create: `scripts/bump/rewrite.mjs`
- Test: `scripts/bump/rewrite.test.mjs`

**Interfaces:**
- Produces (pure string transforms, so they are testable without touching disk):
  - `rewritePackageVersion(json: string, next: string): string` — replaces the top-level `"version"` value in `package.json` text, preserving formatting.
  - `rewriteProtocolVersion(source: string, next: string): string` — replaces the `ACP_PROTOCOL_VERSION = '<old>'` literal in `src/protocol/version.ts`. Throws if the literal is not found.
  - `changelogEntry({ date, release, protocol }): string` — one-line ledger entry.

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, expect, it } from 'vitest'
import {
  changelogEntry,
  rewritePackageVersion,
  rewriteProtocolVersion,
} from './rewrite.mjs'

describe('rewritePackageVersion', () => {
  it('replaces only the top-level version', () => {
    const json = '{\n  "name": "acp",\n  "version": "1.0.0",\n  "bin": {}\n}\n'
    expect(rewritePackageVersion(json, '1.1.0')).toContain('"version": "1.1.0"')
  })
})

describe('rewriteProtocolVersion', () => {
  it('replaces the protocol constant literal', () => {
    const src = "export const ACP_PROTOCOL_VERSION = '0.1' as const\n"
    expect(rewriteProtocolVersion(src, '0.2')).toBe(
      "export const ACP_PROTOCOL_VERSION = '0.2' as const\n",
    )
  })
  it('throws when the literal is absent', () => {
    expect(() => rewriteProtocolVersion('nothing here', '0.2')).toThrow(/ACP_PROTOCOL_VERSION/)
  })
})

describe('changelogEntry', () => {
  it('renders a one-line ledger entry', () => {
    const line = changelogEntry({ date: '2026-07-13', release: '1.1.0', protocol: null })
    expect(line).toMatch(/2026-07-13/)
    expect(line).toMatch(/release 1\.1\.0/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node_modules/.bin/vitest run scripts/bump/rewrite.test.mjs`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write minimal implementation**

```javascript
// @Acp.Scripts.Bump.Rewrite — pure version-file transforms + one-line ledger entry
export const rewritePackageVersion = (json, next) => {
  const pattern = /("version"\s*:\s*")([^"]+)(")/
  if (!pattern.test(json)) throw new Error('package.json has no "version" field')
  return json.replace(pattern, `$1${next}$3`)
}

export const rewriteProtocolVersion = (source, next) => {
  const pattern = /(ACP_PROTOCOL_VERSION\s*=\s*')([^']+)(')/
  if (!pattern.test(source)) {
    throw new Error('source has no ACP_PROTOCOL_VERSION literal')
  }
  return source.replace(pattern, `$1${next}$3`)
}

export const changelogEntry = ({ date, release, protocol }) => {
  const parts = []
  if (release) parts.push(`release ${release}`)
  if (protocol) parts.push(`protocol ${protocol}`)
  return `- ${date} · Version bump · ${parts.join(', ')} · via acp bump · risk LOW`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node_modules/.bin/vitest run scripts/bump/rewrite.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/bump/rewrite.mjs scripts/bump/rewrite.test.mjs
git commit -m "feat(versioning): add version-file rewrite transforms"
```

---

### Task 8: Orchestrator `acp bump` + `--dry-run` integration + npm script

**Files:**
- Create: `scripts/acp-bump.mjs`
- Test: `scripts/acp-bump.test.mjs`
- Modify: `package.json` (add `"bump": "node scripts/acp-bump.mjs"` to `scripts`)

**Interfaces:**
- Consumes: `collectSignals`, `resolveBaseline` (`scripts/bump/collect.mjs`); `classifyRelease`, `classifyProtocol`, `validateOverride`, `RELEASE_RANK` (from compiled `dist/domain/versioning/index.js`); `bumpRelease`, `bumpProtocol`; `rewrite*` (`scripts/bump/rewrite.mjs`).
- Produces: `planBump({ signals, current, overrides, force }): { release: {level,next,reasons}, protocol: {level,next,reasons}, violations: string[] }` — the pure decision core, exported for the integration test. The `main()` entry wires argv → collect → planBump → print → (unless `--dry-run`) write, and requires `--protocol <level>` before any protocol write. Baseline guard: if `resolveBaseline` is `null` and neither `--since` nor `--baseline` given, print a warning and exit non-zero.

- [ ] **Step 1: Write the failing test** (drives the pure `planBump` core over fixtures — no disk, no git)

```javascript
import { describe, expect, it } from 'vitest'
import { planBump } from './acp-bump.mjs'

const current = { release: '1.0.0', protocol: '0.1' }

describe('planBump', () => {
  it('proposes a minor release for a feat and no protocol bump', () => {
    const plan = planBump({
      signals: { commits: [{ type: 'feat', breaking: false }], protocolSurfaceChanged: false, protocolFiles: [] },
      current,
      overrides: {},
      force: false,
    })
    expect(plan.release.level).toBe('minor')
    expect(plan.release.next).toBe('1.1.0')
    expect(plan.protocol.level).toBe('none')
    expect(plan.protocol.next).toBe('0.1')
    expect(plan.violations).toEqual([])
  })

  it('never bumps protocol from evidence alone even when the surface changed', () => {
    const plan = planBump({
      signals: { commits: [{ type: 'feat', breaking: false }], protocolSurfaceChanged: true, protocolFiles: ['src/protocol/schema/common.ts'] },
      current,
      overrides: {},
      force: false,
    })
    expect(plan.protocol.level).toBe('none')
    expect(plan.protocol.reasons.join(' ')).toMatch(/decide explicitly/)
  })

  it('advances protocol only under an explicit override', () => {
    const plan = planBump({
      signals: { commits: [], protocolSurfaceChanged: true, protocolFiles: ['src/protocol/schema/common.ts'] },
      current,
      overrides: { protocol: 'major' },
      force: false,
    })
    expect(plan.protocol.level).toBe('major')
    expect(plan.protocol.next).toBe('0.2')
  })

  it('records a violation for a release override below the evidence', () => {
    const plan = planBump({
      signals: { commits: [{ type: 'feat', breaking: true }], protocolSurfaceChanged: false, protocolFiles: [] },
      current,
      overrides: { release: 'patch' },
      force: false,
    })
    expect(plan.violations.length).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node_modules/.bin/vitest run scripts/acp-bump.test.mjs`
Expected: FAIL — cannot resolve module / `planBump` undefined.

- [ ] **Step 3: Write minimal implementation** (only the `planBump` core + a thin `main`; import policy from `dist`)

```javascript
// @Acp.Scripts.AcpBump — orchestrate evidence -> policy -> confirm -> apply
import { readFileSync, writeFileSync } from 'node:fs'
import {
  classifyProtocol,
  classifyRelease,
  validateOverride,
} from '../dist/domain/versioning/index.js'
import { bumpProtocol, bumpRelease } from '../dist/domain/versioning/index.js'
import { collectSignals, resolveBaseline } from './bump/collect.mjs'
import {
  changelogEntry,
  rewritePackageVersion,
  rewriteProtocolVersion,
} from './bump/rewrite.mjs'

export const planBump = ({ signals, current, overrides, force }) => {
  const violations = []

  const relProposal = classifyRelease(signals)
  let relLevel = relProposal.level
  if (overrides.release) {
    const v = validateOverride(relProposal.level, overrides.release, { force })
    if (v.ok) relLevel = v.level
    else violations.push(v.violation)
  }

  const protoProposal = classifyProtocol(signals)
  let protoLevel = protoProposal.level
  if (overrides.protocol) {
    // An explicit protocol level is always honored (there is no evidence level to contradict).
    protoLevel = overrides.protocol
  }

  return {
    release: {
      level: relLevel,
      next: bumpRelease(current.release, relLevel),
      reasons: relProposal.reasons,
    },
    protocol: {
      level: protoLevel,
      next: bumpProtocol(current.protocol, protoLevel),
      reasons: protoProposal.reasons,
    },
    violations,
  }
}

const parseArgs = (argv) => {
  const flags = { overrides: {}, force: false, dryRun: false, tag: false, baseline: false, since: null }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--release') flags.overrides.release = argv[++i]
    else if (arg === '--protocol') flags.overrides.protocol = argv[++i]
    else if (arg === '--since') flags.since = argv[++i]
    else if (arg === '--force') flags.force = true
    else if (arg === '--dry-run') flags.dryRun = true
    else if (arg === '--tag') flags.tag = true
    else if (arg === '--baseline') flags.baseline = true
  }
  return flags
}

const main = () => {
  const flags = parseArgs(process.argv.slice(2))
  const baseline = flags.since ?? resolveBaseline()

  if (flags.baseline) {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    console.log(`Establish baseline: tag v${pkg.version} at HEAD, then re-run acp bump.`)
    console.log(`  git tag v${pkg.version}`)
    return
  }
  if (!baseline) {
    console.error('acp bump: no v* tag found. Run `acp bump --baseline` first, or pass --since <ref>.')
    process.exitCode = 1
    return
  }

  const signals = collectSignals({ since: baseline })
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  const versionSource = readFileSync('src/protocol/version.ts', 'utf8')
  const currentProtocol = /ACP_PROTOCOL_VERSION\s*=\s*'([^']+)'/.exec(versionSource)?.[1] ?? '0.0'

  const plan = planBump({
    signals,
    current: { release: pkg.version, protocol: currentProtocol },
    overrides: flags.overrides,
    force: flags.force,
  })

  console.log(`Baseline: ${baseline}`)
  console.log(`Release:  ${pkg.version} -> ${plan.release.next} (${plan.release.level})`)
  plan.release.reasons.forEach((r) => console.log(`  · ${r}`))
  console.log(`Protocol: ${currentProtocol} -> ${plan.protocol.next} (${plan.protocol.level})`)
  plan.protocol.reasons.forEach((r) => console.log(`  · ${r}`))

  if (plan.violations.length > 0) {
    plan.violations.forEach((v) => console.error(`VIOLATION: ${v}`))
    process.exitCode = 1
    return
  }
  if (flags.dryRun) {
    console.log('(dry run — no files written)')
    return
  }

  if (plan.release.level !== 'none') {
    writeFileSync('package.json', rewritePackageVersion(readFileSync('package.json', 'utf8'), plan.release.next))
  }
  if (plan.protocol.level !== 'none') {
    writeFileSync('src/protocol/version.ts', rewriteProtocolVersion(versionSource, plan.protocol.next))
  }
  if (plan.release.level !== 'none' || plan.protocol.level !== 'none') {
    const entry = changelogEntry({
      date: new Date().toISOString().slice(0, 10),
      release: plan.release.level !== 'none' ? plan.release.next : null,
      protocol: plan.protocol.level !== 'none' ? plan.protocol.next : null,
    })
    const changelog = readFileSync('wiki/CHANGELOG.md', 'utf8')
    writeFileSync('wiki/CHANGELOG.md', changelog.replace(/\n/, `\n\n${entry}\n`))
  }
  console.log('acp bump: applied. Review the diff, then commit.')
}

// Run main() only as a CLI, never on import (keeps the test importing planBump clean).
if (import.meta.url === `file://${process.argv[1]}`) main()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node_modules/.bin/vitest run scripts/acp-bump.test.mjs`
Expected: PASS.

- [ ] **Step 5: Add the npm script** — insert into `package.json` `scripts` after `"test"`: `"bump": "node scripts/acp-bump.mjs"`.

- [ ] **Step 6: Build + smoke the dry run against the real repo**

Run: `node_modules/.bin/tsc -p tsconfig.build.json && node scripts/acp-bump.mjs --baseline`
Expected: prints the `git tag v1.0.0` baseline instruction (no writes). Then, after tagging in a scratch check, `node scripts/acp-bump.mjs --dry-run` prints a proposal with no file writes.

- [ ] **Step 7: Commit**

```bash
git add scripts/acp-bump.mjs scripts/acp-bump.test.mjs package.json
git commit -m "feat(versioning): add acp bump orchestrator and npm script"
```

---

### Task 9: README usage + final gate sweep

**Files:**
- Modify: `README.md` (add an "`acp bump` — versioning" subsection under the existing tooling/scripts docs)

**Interfaces:** none (documentation + verification).

- [ ] **Step 1: Document usage** — a short subsection: the two-line policy summary, `acp bump --baseline`, `acp bump --dry-run`, `acp bump --release <level>`, `acp bump --protocol <level> --force`, and the decoupling rule. Link `[[ADR-0014-version-bump-policy]]`.

- [ ] **Step 2: Full gate sweep**

Run: `node_modules/.bin/tsc --noEmit && node_modules/.bin/eslint . && node_modules/.bin/prettier --check . && node_modules/.bin/vitest run`
Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(versioning): document acp bump usage"
```

---

## Self-Review

**Spec coverage:**
- Two-line policy + decoupling + 0.x → Task 1 (ADR), Task 2 (`bumpProtocol` 0.x), Task 3 (classify).
- Evidence-driven proposal + justification → Task 3 `reasons`, Task 6 collectors.
- Human confirm + guardrails + refuse contradictory override → Task 3 `validateOverride`, Task 8 `planBump.violations` + `--dry-run`/apply gate.
- Protocol never auto-bumps from a diff (Grill G3) → Task 3 `classifyProtocol` always `none`; Task 8 requires explicit `--protocol`.
- Baseline story (Grill G5) → Task 8 `--baseline` + no-tag guard.
- version.ts brittleness (Grill G6) → Task 7 `rewriteProtocolVersion` throws when literal absent + unit test; Task 8 Step 6 real-file build/smoke.
- FMCF docs-first → Task 1 ADR, Task 4 wiki mirror.
- Writes to package.json / version.ts / CHANGELOG → Task 7 + Task 8.

**Placeholder scan:** none — every code step carries full code.

**Type consistency:** `SemverLevel`, `ChangeSignals` (`commits`/`protocolSurfaceChanged`/`protocolFiles`), `Proposal` (`level`/`reasons`), `RELEASE_RANK`, `validateOverride` result shape, and the `parseConventionalCommits` object shape are used identically across Tasks 2, 3, 5, 6, 8.

**Known deviation from spec:** the spec named `scripts/bump/collect.mjs` for both collectors; the plan splits the pure parser (`parse-commits.mjs`, Task 5) from the impure git adapter (`collect.mjs`, Task 6) so the parser is testable without git. This strengthens the ports/adapters boundary the spec called for.
