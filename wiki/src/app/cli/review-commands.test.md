---
type: module
path: '@root/src/app/cli/review-commands.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
depth_score: 0.42
depth_status: MEDIUM
tags: [module, medium, test]
aliases: [review-commands-test]
---

# Review Commands Test

## Purpose

Pin the review-specific CLI parser edges that would make the broad
[[cli-commands]] regression file too large. The current focus is signed approval
evidence: reviewers can approve with durable signature metadata while unsigned
approval remains unchanged.

## Interface

```typescript
describe('review command parsing', () => {
  it('parses review approve with signed approval evidence', ...)
  it('fails signed review approve when signature metadata is missing', ...)
})
```

## Algorithm

The happy-path assertion parses `review approve` with `--met`, `--signature`,
`--signature-algorithm`, `--signature-key`, and optional `--signed-at`, then
expects a `POST /v1/reviews/{id}/approve` request containing
`approval_signature`. The negative assertion supplies a signature value without
the required algorithm/key metadata and expects `CliError` before any HTTP
request can be built.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT test review service state transitions here; this is parser-only.
- ❌ Do NOT accept signed approval evidence with implicit algorithm or key id.
- ❌ Do NOT move these cases back into [[cli-commands]] while that file is near
  the size guard.

## Depth

MEDIUM (0.42). The test is narrow, but it keeps a user-facing review evidence
path pinned without bloating the central parser suite.

## Referenced by

[[cli/_MOC]] · [[cli-review-commands]] · [[cli-commands]]
