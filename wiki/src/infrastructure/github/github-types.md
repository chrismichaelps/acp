---
type: module
path: '@root/src/infrastructure/github/github-types.ts'
fidelity: Active
domain: '[[Review]]'
grammar: '[[grammar/typescript]]'
seam: '[[GitHub]]'
depth_score: 0.56
depth_status: MEDIUM
tags: [module, medium]
aliases: [github-types, PrRef, GitHubReviewComment]
---

# GitHub Types

## Purpose

Define the value shapes crossing the [[GitHub]] seam and parse full/short PR refs.

## Interface

Exports `MergeMethod`, `PrRef`, `PullRequestRef`, `GitHubReviewComment`,
`PostCommentInput`, and `parsePrRef(input): Either<PrRef, GitHubError>`.

## Algorithm

`parsePrRef` accepts a GitHub pull-request URL or `owner/repo#number`, then returns
the normalized owner, repository, and numeric PR number.

## Negative Logic

- ❌ Do NOT perform I/O or throw on malformed refs.
- ❌ Do NOT accept refs without an explicit owner, repository, and PR number.

## Depth

MEDIUM. Shared shapes keep provider data normalization out of bridge callers.

## Grill Log

- **Q:** Why return `Either`? **A:** Parsing is synchronous and pure; callers can
  lift the typed failure into Effect without exceptions.

## Referenced by

[[github-gateway]] · [[github-gateway-gh]] · [[github-gateway-fake]] ·
[[github-review-thread]] · [[github-types.test]] · [[github/_MOC]]
