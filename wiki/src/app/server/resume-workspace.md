---
type: module
path: '@root/src/app/server/resume-workspace.ts'
fidelity: Active
domain: '[[WorkUnit]]'
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.5
depth_status: MEDIUM
tags: [module, seam, medium, tokens]
aliases: [resume-workspace, budgetResume, resumeDigest]
---

# Resume Workspace

## Purpose

Shape the [[resume-routes|resume packet]] as a **global workspace** — a
limited-capacity, salience-ranked, write-once-read-many view — so multi-agent
context exchange stays token-efficient ([[ADR-0010-context-exchange-optimization]],
bottleneck B4: the resume packet inlines the full accumulated state). The design
frame is Global Workspace Theory: a workspace admits content by _salience_ and is
_written once, read many_. This module is the pure, transport-level shaping;
domain services are unchanged.

## Interface

```typescript
export const parseBudget: (raw: string | undefined) => number | null
export const budgetResume: (
  artifacts: readonly Artifact[],
  reviews: readonly Review[],
  latestGrillReviewId: ReviewId | null,
  budget: number | null,
) => BudgetedResume // { artifacts, reviews, elided? }
export const resumeDigest: (
  encodedFullPacket: string,
  budget: number | null,
) => string
export const etagOf: (digest: string) => string
```

## Algorithm

- **`budgetResume`** (limited capacity + selective broadcast): with a numeric
  `budget`, inline the `budget` most salient (most-recent, `id`-tiebroken)
  artifacts and reviews; move the remainder to `elided: { artifacts?, reviews? }`
  reference sets (`{ count, ids }`). `budget === null` disables budgeting.
- **`resumeDigest` / `etagOf`** (write-once-read-many): a stable `sha256` over the
  deterministic encoding of the _full_ packet plus the budget, quoted as an HTTP
  `ETag`. Any entity change (even an elided one) or budget change busts it, so
  `If-None-Match` revalidation in [[resume-routes]] is correct.
- **`parseBudget`**: a `?budget=` value is a non-negative integer, else `null`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT budget `open_comments`, `latest_grill`, `work`, or `latest_checkpoint`
  — they are gate-critical or already bounded.
- ❌ Do NOT drop a gate-critical review: an `approved` review and the review tied
  to `latest_grill` are pinned and survive even `budget=0`, so a budgeted packet
  can never flip the merge gate ([[gh-reconcile]] `evaluateMergeGate`).
- ❌ Do NOT introduce Effect or I/O here; the module is pure so it is exhaustively
  unit-testable.

## Depth

MEDIUM (0.5). Small pure surface, but it carries the correctness guard that keeps
salience budgeting safe for the merge gate and the digest contract that makes
`304` revalidation sound.

## Referenced by

[[resume-routes]] · [[ADR-0010-context-exchange-optimization]] · [[server/_MOC]]
