---
type: decision
status: ACCEPTED
date: 2026-08-06
tags: [adr, accepted, work-units, cancellation, spawn-graph]
aliases: [ADR-0027, subtree-cancellation]
---

# ADR-0027 — Subtree Cancellation

## Status

ACCEPTED — implemented.

Delivered: `planSubtreeCancellation` (pure — what to cancel, in what order, and
what blocks it), `WorkUnitService.cancelSubtree` executing that plan,
`POST /v1/work/:work_id/cancel_subtree`, and `acp work cancel-subtree`.

The plan is pure and separately tested because the ordering rule — deepest-first,
root last, root only when nothing blocked — is the whole correctness argument,
and it is worth asserting without a store in the way.

## Context

[[ADR-0021-work-unit-spawn-graph]] deliberately deferred cascade cancel,
recording three unsettled questions: atomicity across a subtree, event volume,
and what happens to a descendant that is mid-review. Delegation shipped without
it, so abandoning a decomposed task means cancelling every unit by hand, in an
order the caller has to work out.

The deferred questions have a sharper answer than they did, because the
transition table settles most of it. Only `open`, `claimed` and `running` admit
`cancelled`. A descendant that is `blocked`, `needs_review`,
`changes_requested` or `approved` **cannot be cancelled at all** without first
being moved somewhere else. Cascade cannot paper over that.

## Decision

### Cancel what is legal, report what is not

`cancelSubtree` walks the descendants of a work unit and cancels each one whose
current state admits `cancelled`. A descendant that is already terminal is
skipped silently — it is finished, which is what cancellation was for. A
descendant that is non-terminal but not cancellable is **reported**, not forced.

Forcing would mean inventing transitions the state machine forbids, and the
alternative — failing the whole call — helps nobody, because there is no
atomicity to protect (see below). Reporting lets the caller unblock or resolve
those units and re-run.

### Deepest-first, and the root only if the subtree is clear

Descendants are cancelled deepest-first, and the root is cancelled **only when
no descendant was reported**.

This preserves the invariant [[ADR-0021-work-unit-spawn-graph]] already
maintains from the other direction: a parent never sits in a finished state
above live children. Cancelling the root first, or regardless, would produce
exactly the situation the completion gate exists to prevent.

### Not atomic, and idempotent instead

Each cancellation is its own transition against its own row. The storage port
exposes no cross-row transaction, and the in-memory adapter could not honour one
— the same constraint recorded in ADR-0021's concurrency note.

Rather than claim atomicity it cannot provide, the operation is **idempotent**:
re-running it skips units already cancelled and retries the rest. A partial
cascade is therefore a safe, resumable state rather than a corrupt one, which is
the property that actually matters when a call fails halfway.

### Bounded by the existing descendant ceiling

The walk reuses `listDescendants`, so it inherits the configured depth cap and
`DEFAULT_DESCENDANT_LIMIT`. Event volume is bounded by the same ceiling that
already bounds subtree reads — one `work.cancelled` event per unit actually
cancelled, and none for units skipped or reported.

## Rationale

The three deferred questions each turned out to have a conservative answer that
required no new machinery: atomicity is replaced by idempotence, event volume is
already bounded by the read ceiling, and mid-review descendants are simply not
cancellable, so they are surfaced instead of forced.

Reporting rather than failing is the choice most likely to be argued with. It is
right because a cascade that refuses entirely on one blocked descendant leaves
the caller worse off than one that cancels the fourteen it can and names the
fifteenth.

## Consequences

`cancelSubtree` can partially succeed, and its result must be read rather than
assumed: callers get the ids cancelled and the units that stopped the root from
being cancelled. An agent that ignores the report will believe a subtree is
cancelled when its root is still live.

A `blocked` work unit could not be cancelled at all when this ADR shipped —
not by this operation and not directly — because the transition table had no
`blocked → cancelled` edge. That was recorded here as an open question rather
than answered inside a cascade feature, and is now settled by
[[ADR-0028-cancelling-blocked-work]]: blocked descendants are cancellable, so
they no longer block a cascade.

## Alternatives

**Cancel the root first, then descendants.** Rejected: it produces a cancelled
parent above live children, precisely what the completion gate prevents from the
other direction.

**Fail the entire cascade if any descendant is uncancellable.** Rejected: there
is no atomicity to preserve, so the failure buys nothing and cancels nothing.

**Force uncancellable descendants through intermediate transitions.** Rejected:
it invents state-machine paths the table forbids and would let a cascade move
work out of review without a reviewer.

**Claim atomicity via a storage transaction.** Rejected: the port exposes none
and the in-memory adapter could not honour it.

## Validation

Acceptance requires tests proving: a subtree of cancellable units is fully
cancelled including the root; descendants are cancelled before their parents;
an uncancellable descendant is reported and leaves the root uncancelled; an
already-terminal descendant is skipped without being reported; re-running after
a partial cascade cancels the remainder and is safe; a childless unit cancels
itself; and one `work.cancelled` event is emitted per unit actually cancelled.

## Grill Log

- **Q:** Why report rather than fail? **A:** There is no atomicity to protect,
  so failing cancels nothing and leaves the caller worse off than a partial
  cascade plus a precise list of what stopped it. _Rejected:_ all-or-nothing.
- **Q:** Why cancel the root last? **A:** Root-first leaves a cancelled parent
  above live children — the exact shape ADR-0021's completion gate exists to
  prevent. _Rejected:_ root-first ordering.
- **Q:** Should `blocked → cancelled` be added so cascade is more complete?
  **A:** Probably, but it changes behaviour far beyond cascade and deserves its
  own decision rather than arriving as a side effect. _Rejected:_ editing the
  transition table inside this ADR.

## Referenced by

[[00-INDEX]]
