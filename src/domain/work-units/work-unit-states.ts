/** @Acp.Domain.WorkUnits.States — the work unit state machine, as data */
import type { EventType, WorkState } from '../../protocol/schema/index.js'

/** The only legal state transitions. An empty set marks a terminal state. */
export const allowedTransitions: Record<WorkState, ReadonlySet<WorkState>> = {
  open: new Set(['claimed', 'cancelled']),
  claimed: new Set(['running', 'cancelled']),
  running: new Set(['blocked', 'needs_review', 'cancelled']),
  // `cancelled` alongside `running`: blocked work is stalled on something
  // external, and abandoning it should not require pretending it resumed first.
  // See [[ADR-0028-cancelling-blocked-work]].
  blocked: new Set(['running', 'cancelled']),
  needs_review: new Set([
    'running',
    'approved',
    'rejected',
    'changes_requested',
  ]),
  changes_requested: new Set(['running']),
  approved: new Set(['completed']),
  rejected: new Set(),
  completed: new Set(),
  cancelled: new Set(),
}

/**
 * A state is terminal when the transition table admits nothing further. Derived
 * from the table rather than listed separately so a future `WorkState` cannot
 * silently escape the spawn-graph completion gate.
 */
export const isTerminal = (state: WorkState): boolean =>
  allowedTransitions[state].size === 0

/**
 * States in which a parent may still take on new children. Listed explicitly
 * rather than derived, so that a newly added `WorkState` defaults to refusing
 * children — the conservative direction. See [[ADR-0021-work-unit-spawn-graph]].
 */
export const childAcceptingStates: ReadonlySet<WorkState> = new Set([
  'open',
  'claimed',
  'running',
  'blocked',
  'changes_requested',
])

/** Transitions a parent may not take while a direct child is unfinished. */
export const childGatedTargets: ReadonlySet<WorkState> = new Set([
  'needs_review',
  'completed',
])

export const eventTypeForTransition = (
  from: WorkState,
  to: WorkState,
): EventType => {
  switch (to) {
    case 'claimed':
      return 'work.claimed'
    case 'running':
      // Three origins reach `running`, and each means something different to a
      // consumer replaying the log. Collapsing the last two into
      // `work.unblocked` asserted a `blocked` state the unit was never in,
      // which is the replay corruption [[ADR-0028-cancelling-blocked-work]]
      // refused to accept from the other direction. See [[ADR-0029-resumption-event-accuracy]].
      return from === 'claimed'
        ? 'work.started'
        : from === 'blocked'
          ? 'work.unblocked'
          : 'work.resumed'
    case 'blocked':
      return 'work.blocked'
    case 'needs_review':
      return 'work.needs_review'
    case 'changes_requested':
      return 'review.changes_requested'
    case 'approved':
      return 'review.approved'
    case 'rejected':
      return 'review.rejected'
    case 'completed':
      return 'work.completed'
    case 'cancelled':
      return 'work.cancelled'
    case 'open':
      return 'work.created'
  }
}
