---
type: decision
status: ACCEPTED
date: 2026-08-07
tags: [adr, accepted, events, work-units, replay, protocol]
aliases: [ADR-0029, resumption-event-accuracy]
---

# ADR-0029 — Resumption Event Accuracy

## Status

ACCEPTED — implemented.

Delivered: a new `work.resumed` event type; `eventTypeForTransition` in
`src/domain/work-units/work-unit-states.ts` now distinguishes the three origins
that reach `running`; and `src/domain/work-units/work-unit-states.test.ts` pins
the invariant that `work.unblocked` has exactly one truthful origin.

## Context

Four states may transition into `running`, and the event mapping collapsed them
into two:

```
claimed            -> running   ->  work.started
blocked            -> running   ->  work.unblocked
needs_review       -> running   ->  work.unblocked   ← never blocked
changes_requested  -> running   ->  work.unblocked   ← never blocked
```

The last two are false. `work.unblocked` is the counterpart of `work.blocked`;
emitting it asserts the unit had been in `blocked`. Work returning from the
review gate — because a review was cancelled, or because a reviewer requested
changes and the worker picked it back up — was never blocked at all.

This is not cosmetic. The event log is append-only and is the substrate every
consumer replays: `readAfter` feeds the event tail
([[ADR-0025-event-tail-reads-persistence-metrics]]), and agents resuming from a
checkpoint reconstruct what happened from it. A consumer folding these events
into a state machine sees `work.needs_review` followed by `work.unblocked` and
must either infer a `blocked` state that never existed, or special-case the
event against the very history it is trying to derive.

The defect surfaced during dogfooding: the standard review round-trip in
`cli-dogfood-support.ts` lists `work.unblocked` among its required events, and
it gets there via `changes_requested -> running`. The scenario asserting the
protocol's own happy path was asserting the wrong event.

## Decision

### `work.unblocked` is reserved for work that was blocked

Exactly one origin — `blocked -> running` — may emit it. That is the only
transition for which the claim is true.

### A new `work.resumed` event covers the review origins

`needs_review -> running` and `changes_requested -> running` both emit
`work.resumed`: work has returned from the review gate and is live again.

These two share an event deliberately. They are the same fact — the review gate
released the unit — and the _reason_ it released is already fully recorded by
the preceding `review.cancelled` or `review.changes_requested` event. Minting a
second event type to re-encode information the log already carries would add
wire vocabulary without adding knowledge.

### Adding an event type is treated as additive, not as a protocol break

`EventType` is a closed `Schema.Literal` union, so a strict consumer decoding an
unrecognised value will refuse it. This repo has nonetheless added event types
alongside features before — review cancellation (#79), workspace memory (#102),
review comments (#251) — and the union is regenerated into `openapi.json` on
each such change.

The judgement is that the alternative is worse. Consumers already have to handle
event types they do not act on; a consumer that hard-fails on an unknown one is
already fragile against every future feature. Trading that for a permanently
false statement in an append-only log is the wrong direction, and it is the
exact trade [[ADR-0028-cancelling-blocked-work]] declined when it refused to
write `work.unblocked` for work that never unblocked.

## Rationale

The append-only log is ACP's most load-bearing artifact: it is how agents
resume, how the tail endpoint works, and how a coordination history is audited
after the fact. Its value rests entirely on each entry being true when written,
because nothing downstream can repair a false one — that is what append-only
means.

Reserving `work.unblocked` to its single truthful origin is also what makes the
invariant testable. The property "exactly one origin emits this event" is
checkable against the transition table itself, so a future `WorkState` that
reaches `running` cannot silently inherit the wrong event: it fails the pinned
origin set instead.

## Consequences

Consumers matching on `work.unblocked` to detect work returning from review
will stop seeing it and must add `work.resumed`. This is a behaviour change for
existing consumers, and the reason it is acceptable is that those consumers were
being told something untrue — the fix is what lets them be correct, not a
regression they must work around.

`openapi.json` regenerates with the new literal in three places, and
`check:openapi` gates that the committed contract matches the schema.

The dogfood scenario's required-event list now expects `work.resumed`, which
means the end-to-end script verifies the corrected mapping on every CI run
rather than only the unit tests doing so.

## Alternatives

**Leave it, and document that `work.unblocked` means "resumed".** Rejected:
that redefines an event by prose while `work.blocked` continues to mean the
literal thing, leaving two events whose names imply a pairing they no longer
have. Documentation cannot fix a log entry that is already false.

**Reuse `work.started` for the review origins.** Rejected: equally false in the
other direction. The work started once, when it was first claimed, and a
consumer counting starts would double-count every review round-trip.

**Two distinct events, `work.review_cancelled_resume` and
`work.changes_requested_resume`.** Rejected: the distinguishing information is
already in the immediately preceding event, so this adds wire vocabulary that
carries nothing a consumer cannot already read.

**Add a `reason` field to the existing `work.unblocked` payload.** Rejected: it
keeps the false type name as the primary signal and makes correctness depend on
consumers reading a discriminator inside a payload they have no reason to
inspect. The type is what consumers match on, so the type has to be right.

## Validation

Acceptance requires tests proving: `blocked -> running` is the only transition
emitting `work.unblocked`; `needs_review -> running` and
`changes_requested -> running` both emit `work.resumed`; `claimed -> running`
still emits `work.started`; the set of origins reaching `running` is pinned, so
a new one cannot silently inherit a mapping; every legal transition in the table
maps to some event type; and the review-cancellation event sequence in
`review-service.test.ts` reflects the corrected type.

Plus the regenerated `openapi.json` passing `check:openapi`, the dogfood
scenario passing with `work.resumed` in its required-event list, and the full
typecheck/lint/format/suite gate.

## Grill Log

- **Q:** Is adding to a closed protocol union justified for a naming problem?
  **A:** It is not a naming problem. `work.unblocked` is a factual claim about
  which state the unit occupied, and it was false for two of three origins in an
  append-only log that consumers replay. _Rejected:_ documenting the workaround.
- **Q:** Why do the two review origins share one event when the whole point is
  distinguishing origins? **A:** The point is not distinguishing origins, it is
  not lying about them. Both origins are truthfully "returned from the review
  gate", and which gate outcome caused it is already the preceding event.
  _Rejected:_ one event per origin.
- **Q:** What breaks for a consumer today? **A:** Anything matching
  `work.unblocked` to catch a post-review resume. That consumer was relying on
  the bug; the correction is what makes it able to be right. _Accepted as a
  documented behaviour change._
- **Q:** How does this not recur when a new `WorkState` is added? **A:** The
  origin set is derived from `allowedTransitions` and pinned by test, so a new
  state reaching `running` fails that assertion rather than defaulting into
  `work.resumed`. _Rejected:_ relying on review to catch it.

## Referenced by

[[00-INDEX]]
