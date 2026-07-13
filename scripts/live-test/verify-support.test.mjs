import { describe, expect, it } from 'vitest'
import { evaluateLiveAgentRun } from './verify-support.mjs'

const event = (seq, type, actor, workId) => ({
  id: `event_${String(seq)}`,
  seq,
  type,
  actor,
  ...(workId === undefined ? {} : { work_id: workId }),
})

const validInput = () => {
  const events = [
    event(1, 'work.created', 'agent_planner', 'work_a'),
    event(2, 'work.created', 'agent_planner', 'work_b'),
    event(3, 'lease.denied', 'agent_worker_a'),
    event(4, 'lease.denied', 'agent_worker_b'),
    event(5, 'checkpoint.created', 'agent_worker_a', 'work_a'),
    event(6, 'checkpoint.created', 'agent_worker_b', 'work_b'),
    event(7, 'review.changes_requested', 'agent_reviewer', 'work_a'),
    event(8, 'review.approved', 'agent_reviewer', 'work_a'),
    event(9, 'review.approved', 'agent_reviewer', 'work_b'),
    event(10, 'work.completed', 'agent_worker_a', 'work_a'),
    event(11, 'work.completed', 'agent_worker_b', 'work_b'),
  ]
  return {
    apiEvents: events.map((item) => ({ ...item })),
    dbEvents: events.map((item) => ({ ...item })),
    fixtureTestPassed: true,
    leases: [{ id: 'lease_1', state: 'released' }],
    memoriesByWork: {
      work_a: [{ id: 'memory_a', work_id: 'work_a', content: 'handoff a' }],
      work_b: [{ id: 'memory_b', work_id: 'work_b', content: 'handoff b' }],
    },
    roleResults: {
      planner: {
        workspace_id: 'workspace_fixture',
        work: [
          { id: 'work_a', title: 'A' },
          { id: 'work_b', title: 'B' },
        ],
      },
      workers: [
        {
          worker: 'agent_worker_a',
          conflicts: ['file:///fixture/src/shared.js'],
          completed: ['work_a'],
          lease_released: true,
        },
        {
          worker: 'agent_worker_b',
          conflicts: ['file:///fixture/src/shared.js'],
          completed: ['work_b'],
          lease_released: true,
        },
      ],
      reviewer: {
        approved: 2,
        changes_requested: 1,
        inspected_memory_ids: ['memory_a', 'memory_b'],
      },
    },
    sharedProbeUri: 'file:///fixture/src/shared.js',
    workItems: [
      { id: 'work_a', state: 'completed' },
      { id: 'work_b', state: 'completed' },
    ],
    workspaceId: 'workspace_fixture',
  }
}

describe('live-agent invariant evaluation', () => {
  it('accepts complete real-agent evidence', () => {
    expect(evaluateLiveAgentRun(validInput()).ok).toBe(true)
  })

  it.each([
    ['empty handoff', (input) => (input.memoriesByWork.work_a = [])],
    ['unfinished work', (input) => (input.workItems[0].state = 'open')],
    [
      'missing contention',
      (input) => (input.roleResults.workers[0].conflicts = []),
    ],
    ['failed fixture', (input) => (input.fixtureTestPassed = false)],
    ['event drift', (input) => input.apiEvents.pop()],
  ])('rejects %s', (_name, mutate) => {
    const input = validInput()
    mutate(input)
    expect(evaluateLiveAgentRun(input).ok).toBe(false)
  })
})
