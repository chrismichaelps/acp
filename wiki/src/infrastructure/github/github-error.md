---
type: module
path: '@root/src/infrastructure/github/github-error.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[GitHub]]'
depth_score: 0.42
depth_status: MEDIUM
tags: [module, medium]
aliases: [github-error, GitHubError]
---

# GitHubError

## Purpose

Carry a failed GitHub command and safe stderr through Effect's typed error channel.

## Interface

```typescript
export class GitHubError extends Data.TaggedError('GitHubError')<{
  readonly command: string
  readonly stderr: string
}> {}
```

## Algorithm

`Data.TaggedError` supplies construction and `_tag` discrimination.

## Negative Logic

- ❌ Do NOT throw subprocess failures or store credentials in error fields.

## Depth

MEDIUM. A minimal typed surface standardizes all [[GitHub]] adapter failures.

## Grill Log

- **Q:** Why retain stderr? **A:** It is required for actionable CLI diagnostics;
  callers must still avoid passing auth output or tokens into the error.

## Referenced by

[[github-types]] · [[github-gateway]] · [[github-gateway-gh]] ·
[[github-review-thread]] · [[github/_MOC]]
