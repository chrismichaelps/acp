---
type: module
path: '@root/src/app/cli/review-comment-commands.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.55
depth_status: MEDIUM
tags: [module, medium, review-gate]
aliases: [cli-review-comment-commands]
---

# CLI Review Comment Commands

## Purpose

Own the `review comment` CLI command map consumed by [[cli-commands]]. Diff-anchored
comment add/resolve/reopen/list are review-gate operations, so their parser rules
live outside the central `parseArgs` dispatcher and alongside the sibling
[[cli-review-commands]] and [[cli-grill-commands]] maps.

## Interface

```typescript
export const reviewCommentCommandHandlers: Readonly<Record<string, CommandHandler>>
```

`review comment --review --work --workspace --artifact --file --side --body
[--line] [--reply-to]` maps to `POST /v1/reviews/:review_id/comments`.
`review comment resolve <comment_id>` / `review comment reopen <comment_id>` map to
the comment-id scoped state routes. `review comment list --review <id> | --work
<id>` maps to the review-scoped or work-scoped comment collection. Because the
registry resolves the longest token prefix first, the three-token
`resolve`/`reopen`/`list` keys win over the two-token add key.

## Algorithm

Add requires the six diff-anchor flags, builds the nested `target`
(`artifact_id`/`file`/`side`), coerces `--line` to a number and omits it (and
`in_reply_to`) when the flag is absent or bare, and sends the full
`AddReviewCommentPayload`. Resolve/reopen share a comment-id state helper that
URL-encodes the id. List branches on a real `--review` value, falling back to the
required `--work` collection.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT send `--line` as a string; the server `target.line` is a number.
- ❌ Do NOT decide comment state here; this module only builds request data.
- ❌ Do NOT drop the required work/workspace/artifact flags — the payload needs
  them even though the review id also routes the path.

## Depth

MEDIUM (0.55). Isolates review-comment parser rules and extends the CLI
feature-registry split for the central parser.

## Referenced by

[[cli-commands]] · [[review-comment-routes]] · [[cli-usage]] · [[cli/_MOC]]
