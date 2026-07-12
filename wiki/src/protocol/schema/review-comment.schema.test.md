---
type: module
path: '@root/src/protocol/schema/review-comment.schema.test.ts'
fidelity: Active
domain: '[[ReviewComment]]'
grammar: '[[grammar/typescript]]'
tags: [module, test, protocol, schema, review-comment]
aliases: [review-comment.schema.test]
---

# Review Comment Schema Tests

## Purpose

Prove [[review-comment.schema]] file-level targeting and ACP/GitHub provenance
default/explicit decoding.

## Interface

Vitest schema-decoding suite over `ReviewComment` and
`AddReviewCommentPayload`.

## Algorithm

Decode a file-level open comment with no line and require `Option.none`. When
provenance fields are absent, default origin to `acp` and external id to none.
Decode an explicit GitHub-origin payload and preserve its external id.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT require a line for file-level review comments.
- ❌ Do NOT default local comments to external provenance.
- ❌ Do NOT discard an explicit external comment id.

## Grill Log

- **Q:** Why test both implicit and explicit provenance? **A:** Local creation
  must stay compact while imported GitHub comments remain idempotently
  traceable. _Rejected:_ one origin model for both paths.

## Referenced by

[[review-comment.schema]] · [[schema/_MOC]] · [[ReviewComment]] · [[src/_MOC]]
