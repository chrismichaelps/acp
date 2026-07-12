---
type: module
path: '@root/src/domain/reviews/review-service.test.ts'
fidelity: Active
domain: '[[Review]]'
grammar: '[[grammar/typescript]]'
tags: [module, test, domain, review, work-unit]
aliases: [review-service.test]
---

# Review Service Tests

## Purpose

Prove [[review-service]] persists review gates, validates requirements, stores
signed approval evidence, couples outcomes to [[WorkUnit]] state, emits ordered
events, indexes reads, and preserves missing-resource errors.

## Interface

Vitest suite over [[work-unit-service]], in-memory [[Storage]], and
[[event-store]].

## Algorithm

Prepare claimed/running work, request review, and require stored `requested`,
work `needs_review`, and ordered request/work events. Approve only with every
requirement met, transition work to approved, and persist/emit optional signature
evidence. Reject partial requirements. Request changes and require coupled
`changes_requested`; cancel and require review `cancelled`, work resumed to
`running`, and `work.unblocked`. Pin work/workspace indexes and
`NotFoundError` for a missing review.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT approve with unmet requirements.
- ❌ Do NOT update review without the corresponding WorkUnit outcome.
- ❌ Do NOT drop supplied signature evidence from storage or events.
- ❌ Do NOT model cancellation as rejection or leave work blocked.
- ❌ Do NOT reorder review/work lifecycle events.

## Grill Log

- **Q:** Why store but not verify signatures here? **A:** The service owns review
  evidence; trust roots and cryptographic policy require a separate seam.
  _Rejected:_ ad hoc verification coupled to state transitions.

## Referenced by

[[review-service]] · [[work-unit-service]] · [[reviews/_MOC]] · [[Review]] ·
[[src/_MOC]]
