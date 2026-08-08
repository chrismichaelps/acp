/** @Acp.Domain.WorkUnits.States.Test — the log must describe what happened */
import { describe, expect, it } from 'vitest'
import type { WorkState } from '../../protocol/schema/index.js'
import {
  allowedTransitions,
  eventTypeForTransition,
  isTerminal,
} from './work-unit-states.js'

const states = Object.keys(allowedTransitions) as WorkState[]

/** Every origin the table admits into `running`. */
const resumeOrigins = states.filter((state) =>
  allowedTransitions[state].has('running'),
)

describe('event type for a transition into running', () => {
  // `work.unblocked` asserts the unit was in `blocked`. Exactly one origin can
  // truthfully make that claim, so any other origin emitting it is a statement
  // about history that never happened — the property this whole file exists to
  // hold. The two review origins sharing `work.resumed` is not a collapse:
  // they are the same fact, that work returned from the review gate.
  it('emits work.unblocked from exactly one origin', () => {
    const unblocking = resumeOrigins.filter(
      (from) => eventTypeForTransition(from, 'running') === 'work.unblocked',
    )
    expect(unblocking).toEqual(['blocked'])
  })

  it('reports a first start as work.started', () => {
    expect(eventTypeForTransition('claimed', 'running')).toBe('work.started')
  })

  // The narrow reading: only work that was actually `blocked` may claim to have
  // unblocked. See [[ADR-0029-resumption-event-accuracy]].
  it('reserves work.unblocked for work that was blocked', () => {
    expect(eventTypeForTransition('blocked', 'running')).toBe('work.unblocked')
  })

  it.each<WorkState>(['needs_review', 'changes_requested'])(
    'reports %s -> running as work.resumed, not work.unblocked',
    (from) => {
      expect(eventTypeForTransition(from, 'running')).toBe('work.resumed')
    },
  )

  // A new origin added to the table without a matching event mapping would
  // silently inherit `work.resumed` and quietly re-create this bug, so the set
  // is pinned rather than derived.
  it('has exactly the origins the mapping accounts for', () => {
    expect([...resumeOrigins].sort()).toEqual([
      'blocked',
      'changes_requested',
      'claimed',
      'needs_review',
    ])
  })
})

describe('transition table', () => {
  it('maps every state to an event type without throwing', () => {
    for (const from of states) {
      for (const to of allowedTransitions[from]) {
        expect(typeof eventTypeForTransition(from, to)).toBe('string')
      }
    }
  })

  it('derives terminality from the absence of outgoing transitions', () => {
    for (const state of states) {
      expect(isTerminal(state)).toBe(allowedTransitions[state].size === 0)
    }
  })
})
