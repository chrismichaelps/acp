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
export const reviewCommentCommandHandlers: Readonly<
  Record<string, CommandHandler>
>
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

## Grill Log

- **Q:** Why coerce `--line` with `Number(...)` instead of forwarding the raw
  flag string?
  **A:** The server `target.line` is `Schema.Number`; a string `"42"` fails the
  body decode with a 400. The CLI emits a JSON number so the request matches the
  contract, and omits the key entirely when the flag is absent or bare so the
  optional `Option` stays `None`. _Rejected:_ sending `line` as a string and
  letting the server reject it.

- **Q:** Why do the three-token `resolve`/`reopen`/`list` keys coexist with the
  two-token add key without ambiguity?
  **A:** [[cli-commands]] resolves the longest matching token prefix first, so
  `review comment resolve <id>` binds the three-token handler while
  `review comment --review …` falls through to the two-token add.

## Referenced by

[[review-comment-commands.test]] · [[cli-commands]] ·
[[review-comment-routes]] · [[cli-usage]] · [[cli/_MOC]]
