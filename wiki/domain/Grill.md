---
type: domain
tags: [domain]
aliases: [Grill, senior grill]
---

# Grill

- **Definition:** A forced senior-question round attached to a [[Review]], where
  blocker/nit questions receive answers and reviewer verdicts before evaluation.
- **Canonical name:** Grill.
- **Not:** A Review outcome; it supplies evidence used by the review gate.
- **States:** `open · passed · failed`; evaluation may return `incomplete` without
  closing while blockers or [[ReviewComment]]s remain open.
- **Example:** A reviewer accepts a concurrency answer, resolves comments, and
  evaluates the Grill to `passed`.

## Referenced by

[[grill-service]] · [[grill-index]] · [[gh-bridge]] · [[domain/_MOC]]
