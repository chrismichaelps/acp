---
type: decision
status: ACCEPTED
date: 2026-08-06
tags: [adr, accepted, work-units, state-machine, cancellation]
aliases: [ADR-0028, cancelling-blocked-work]
---

# ADR-0028 — Cancelling Blocked Work

## Status

ACCEPTED — implemented.

`allowedTransitions.blocked` gains `cancelled` alongside `running`.

## Context

[[ADR-0027-subtree-cancellation]] surfaced this while answering a different
question: the transition table had exactly one edge out of `blocked`, to
`running`. Work stalled on something external therefore could not be abandoned
at all. The only route was `blocked → running → cancelled` — recording that work
resumed, in order to say it never would.

That is a false event in an append-only log whose whole purpose is to be
replayable and true. It also made subtree cancellation stall on any
externally-blocked descendant, which is the case most likely to need abandoning:
work blocked on a dependency that is never coming.

## Decision

`blocked` admits `cancelled`.

The edge is additive — `blocked → running` is unchanged, so nothing that worked
before stops working. `blocked` remains non-terminal, so `isTerminal` and the
[[ADR-0021-work-unit-spawn-graph]] completion gate are unaffected, and `blocked`
stays child-accepting.

## Rationale

Cancellation means "this will not be finished", and that is exactly what is true
of abandoned blocked work. Withholding the edge did not prevent anything: a
caller who wanted to abandon blocked work could still do it, just via a
misleading intermediate transition. The table was forcing a lie rather than
enforcing an invariant.

The change is confined to one entry, and every other state's edges are
untouched, so the blast radius is a single new legal path rather than a reshaped
lifecycle.

## Consequences

`work.cancelled` can now follow `work.blocked` in the event log, which no
consumer previously had to handle — though any consumer treating `cancelled` as
terminal already behaves correctly, since it is.

Subtree cancellation becomes meaningfully more useful: a blocked descendant no
longer stops a cascade, and no longer forces the root to stay live. The
lifecycle diagrams in `ACP-SKILL.md` and [[agent-integration]] are updated,
since they are the contract agents code against.

`WorkState` is untouched, so this is not a protocol change. The transition table
is internal policy rather than wire vocabulary — the distinction that let
[[ADR-0021-work-unit-spawn-graph]] derive terminality from it in the first
place.

## Alternatives

**Leave it and document the workaround.** Rejected: the workaround writes
`work.unblocked` into an append-only log for work that never unblocked, which
corrupts replay for the sake of a table entry.

**Allow cancellation from every non-terminal state**, including `needs_review`
and `approved`. Rejected as a much larger change: those states have a reviewer
mid-decision, and cancelling out from under one is a review-authority question,
not a lifecycle convenience. `blocked` has no such counterparty.

**Introduce a distinct `abandoned` state.** Rejected: it adds wire vocabulary —
a protocol change for every consumer — to express something `cancelled` already
means.

## Validation

Tests prove: a blocked unit cancels directly; a blocked unit can still resume;
a blocked descendant is cancelled by a subtree cascade rather than reported as
blocking it; and the full suite is unaffected, confirming no path depended on
the edge being absent.

## Grill Log

- **Q:** Why not allow cancellation from `needs_review` too, for symmetry?
  **A:** A reviewer is mid-decision there, so it is a question about review
  authority rather than lifecycle convenience. `blocked` has no counterparty to
  override. _Rejected:_ a blanket cancel-from-anywhere edge.
- **Q:** Is this a protocol change? **A:** No. `WorkState` is unchanged; the
  transition table is internal policy, which is exactly why ADR-0021 could
  derive terminality from it. _Rejected:_ treating it as a wire break.

## Referenced by

[[00-INDEX]]
