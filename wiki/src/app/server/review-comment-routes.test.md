---
type: module
path: '@root/src/app/server/review-comment-routes.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, server, review-comment]
aliases: [review-comment-routes.test]
---

# Review Comment Route Tests

## Purpose

Prove [[review-comment-routes]] preserves a diff anchor and enforces the
`review:collaborate` permission plus target-derived workspace binding across all
four comment mutations.

## Interface

Vitest integration suite over the in-process [[acp-router]] after preparing
running work and a requested review.

## Algorithm

Using a workspace-bound collaborator without `workspace:write`, add an open
comment, resolve it, reopen it, and stamp an external id; require all four to
succeed and preserve the diff anchor. Require the comment in both review- and
work-scoped lists. For each mutation, assert `workspace:write` without
`review:collaborate` is denied. Assert a collaborator bound elsewhere is denied
through persisted target derivation. Pin exact error policy: a missing-scope
session gets 403 for any supplied id; correctly scoped missing and foreign ids
produce byte-equivalent 404 `not_found` envelopes for the requested entity/id.
For add, separately lie about body `review_id`, `work_id`, and `workspace_id`;
each produces 400 `invalid_request`, message `Request failed validation.`, and
the ordered ADR-0013 issue string without a write. A `review:respond`-only worker
is denied all four comment mutations.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT drop or reinterpret the diff anchor at the transport boundary.
- ❌ Do NOT let review and work collection views diverge.
- ❌ Do NOT treat resolve as terminal; explicit reopen is supported.
- ❌ Do NOT mutate comment state in route code instead of the service.
- ❌ Do NOT cover only add/resolve/reopen; external-id is the fourth protected
  mutation used by GitHub reconciliation.
- ❌ Do NOT let `workspace:write` pass as a legacy alias.
- ❌ Do NOT claim workspace isolation from a payload-only happy path; exercise a
  real cross-workspace target and conflicting identity fields.
- ❌ Do NOT expect 403 for an existing foreign comment/review; it must be
  observationally identical to a missing target.

## Grill Log

- **Q:** Why assert both list routes? **A:** Reviewers navigate by gate while
  resuming agents navigate by work; both must expose the same stored obligation.
  _Rejected:_ verifying only the creation response.
- **Q:** Why test every mutation instead of one representative route? **A:** The
  acceptance boundary names four independently wired handlers; one stale scope
  would preserve the privilege leak. _Rejected:_ a source-text assertion alone.
- **Q:** Why compare the full missing/foreign envelopes? **A:** Status-only
  equality can still leak through messages/details. _Rejected:_ asserting only
  `not_found` codes.

## Referenced by

[[review-comment-routes]] · [[review-comment-service]] ·
[[review-collaboration-auth]] · [[server/_MOC]] · [[Transport]] · [[src/_MOC]]
