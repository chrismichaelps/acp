---
type: domain
tags: [domain]
aliases: [ReviewComment, review comment]
---

# ReviewComment

- **Definition:** A durable remark within a [[Review]], anchored to an
  [[Artifact]] file/diff side and optionally a line.
- **Canonical name:** ReviewComment.
- **Not:** A [[Review]] outcome or provider-specific GitHub thread; external ids
  only reconcile the durable ACP comment with an adapter.
- **States:** `open · resolved`, with reopen permitted for audit continuity.
- **Example:** A blocker comment on `src/app.ts` line 12 is resolved after a fix.

## Referenced by

[[review-comment-service]] · [[review-comment-index]] · [[grill-service]] ·
[[gh-reconcile]] · [[domain/_MOC]]
