---
type: module
path: '@root/src/infrastructure/github/github-review-thread.ts'
fidelity: Active
domain: '[[Review]]'
grammar: '[[grammar/typescript]]'
seam: '[[GitHub]]'
depth_score: 0.74
depth_status: DEEP
tags: [module, deep]
aliases: [github-review-thread, makeReviewThreadResolver]
---

# GitHub Review Thread Resolver

## Purpose

Hide GitHub's REST/GraphQL identity mismatch: ACP persists a review comment's
REST database id, while thread resolution requires the GraphQL review-thread node
id. The resolver pages review threads until it finds the thread containing that
comment and returns its node id plus current resolution state.

## Interface

### Signatures

```typescript
export interface GitHubReviewThread {
  readonly id: string
  readonly isResolved: boolean
}
export type RunGhText = (
  args: readonly string[],
) => Effect.Effect<string, GitHubError>
export const makeReviewThreadResolver: (
  run: RunGhText,
) => (
  ref: PrRef,
  externalId: string,
) => Effect.Effect<GitHubReviewThread, GitHubError>
```

### Linkage

- **Requires:** [[github-types]] (`PrRef`), [[github-error]], `effect`.
- **Consumed by:** [[github-gateway-gh]] `resolveReviewThread`.

## Algorithm

1. Require `externalId` to be a positive safe integer REST comment id.
2. Call `gh api graphql` for `reviewThreads(first: 100, after: $cursor)`, including
   each thread's node id, `isResolved`, and first 100 comment `databaseId` values.
3. Decode JSON and validate the GraphQL response shape.
4. Return the first thread containing the requested database id.
5. If not found and `pageInfo.hasNextPage`, continue with `endCursor`; otherwise
   fail through `GitHubError`.

## Negative Logic

- ❌ Do NOT pass the REST comment id to `resolveReviewThread(threadId:)`.
- ❌ Do NOT stop at the first 100 review threads when another page exists.
- ❌ Do NOT throw for invalid ids, malformed JSON, missing PRs, or missing threads.
- ❌ Do NOT own the mutation; this module resolves identity only.

## Edge Cases

- Already-resolved thread → return `isResolved: true`; the adapter skips mutation.
- Missing repository/PR or exhausted pages → typed `GitHubError`.
- More than 100 comments in one thread is outside the current bounded query; the
  originating top-level comment is expected within the first page.

## Depth

DEEP (0.74). A two-field result hides pagination, GraphQL variables, JSON shape
validation, provider identity translation, and typed failure mapping.

## Grill Log

- **Q:** Why not change ACP's `external_id` to a GraphQL thread id? **A:** The
  stable external identity is the comment returned by REST list/post; translating
  only when resolving preserves reconciliation and confines GitHub mechanics.
  _Rejected:_ dual ids in the domain record (provider leakage and migration cost).
- **Q:** Should this module perform the mutation too? **A:** No. It resolves
  identity and current state; [[github-gateway-gh]] retains command orchestration.
  _Rejected:_ combined lookup/mutation (harder to test and reuse idempotently).
- **Q:** What if a PR has more than 100 threads? **A:** Follow `pageInfo` until the
  thread is found or pages are exhausted. _Rejected:_ one bounded page (silently
  fails on long-running PRs).

## Referenced by

[[github-gateway-gh]] · [[github-review-thread.test]] · [[github/_MOC]]
