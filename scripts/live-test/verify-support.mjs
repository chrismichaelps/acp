export const evaluateLiveAgentRun = ({
  apiEvents,
  dbEvents,
  fixtureTestPassed,
  leases,
  memoriesByWork,
  roleResults,
  sharedProbeUri,
  workItems,
  workspaceId,
}) => {
  const checks = []
  const check = (name, pass, detail) => checks.push({ name, pass, detail })
  const plannerWorkIds = roleResults.planner.work.map((work) => work.id)
  const expectedWorkIds = [...plannerWorkIds].sort()
  const actualWorkIds = workItems.map((work) => work.id).sort()
  const completedWorkIds = workItems
    .filter((work) => work.state === 'completed')
    .map((work) => work.id)
    .sort()

  check(
    'planner-created-exact-work-set',
    roleResults.planner.workspace_id === workspaceId &&
      expectedWorkIds.length === 2 &&
      JSON.stringify(actualWorkIds) === JSON.stringify(expectedWorkIds),
    `expected=${expectedWorkIds.join(',')} actual=${actualWorkIds.join(',')}`,
  )
  check(
    'all-created-work-completed',
    JSON.stringify(completedWorkIds) === JSON.stringify(expectedWorkIds),
    `completed=${completedWorkIds.join(',')}`,
  )

  const seqs = dbEvents.map((event) => event.seq)
  const contiguous = seqs.every((seq, index) => seq === index + 1)
  check(
    'monotonic-contiguous-event-seq',
    seqs.length > 0 && contiguous,
    `events=${seqs.length} contiguous=${String(contiguous)}`,
  )

  const denied = dbEvents.filter((event) => event.type === 'lease.denied')
  const workerConflictProof = roleResults.workers.every((worker) =>
    worker.conflicts.includes(sharedProbeUri),
  )
  check(
    'deterministic-worker-contention',
    denied.length >= roleResults.workers.length && workerConflictProof,
    `denied=${denied.length} workers=${roleResults.workers.length}`,
  )

  const changes = dbEvents.filter(
    (event) => event.type === 'review.changes_requested',
  )
  const reviewLoop = changes.some((change) =>
    dbEvents.some(
      (event) =>
        event.type === 'review.approved' &&
        event.work_id === change.work_id &&
        event.seq > change.seq,
    ),
  )
  check(
    'review-changes-then-approve',
    reviewLoop &&
      roleResults.reviewer.changes_requested >= 1 &&
      roleResults.reviewer.approved >= 1,
    `event_loop=${String(reviewLoop)} changes=${roleResults.reviewer.changes_requested} approvals=${roleResults.reviewer.approved}`,
  )

  const activeLeases = leases.filter((lease) => lease.state === 'active')
  const workersReleased = roleResults.workers.every(
    (worker) => worker.lease_released,
  )
  check(
    'all-leases-released',
    activeLeases.length === 0 && workersReleased,
    `active=${activeLeases.length} workers_released=${String(workersReleased)}`,
  )

  const checkpointWorkIds = new Set(
    dbEvents
      .filter((event) => event.type === 'checkpoint.created')
      .map((event) => event.work_id),
  )
  const actualMemories = Object.values(memoriesByWork).flat()
  const memoryIds = new Set(actualMemories.map((memory) => memory.id))
  const handoffComplete = expectedWorkIds.every((workId) => {
    const memories = memoriesByWork[workId] ?? []
    return (
      checkpointWorkIds.has(workId) &&
      memories.length > 0 &&
      memories.every(
        (memory) =>
          memory.work_id === workId &&
          typeof memory.content === 'string' &&
          memory.content.trim().length > 0,
      )
    )
  })
  const inspected = roleResults.reviewer.inspected_memory_ids
  const inspectedRealMemories =
    inspected.length > 0 && inspected.every((id) => memoryIds.has(id))
  check(
    'nonempty-handoff-consumed-by-reviewer',
    handoffComplete && inspectedRealMemories,
    `memory=${actualMemories.length} inspected=${inspected.length} checkpoint_work=${checkpointWorkIds.size}`,
  )

  const actors = new Set(dbEvents.map((event) => event.actor))
  const expectedActors = [
    'agent_planner',
    ...roleResults.workers.map((worker) => worker.worker),
    'agent_reviewer',
  ]
  check(
    'distinct-role-actors-persisted',
    expectedActors.every((actor) => actors.has(actor)),
    `expected=${expectedActors.join(',')} observed=${[...actors].join(',')}`,
  )

  const workerCompleted = roleResults.workers
    .flatMap((worker) => worker.completed)
    .sort()
  check(
    'worker-results-match-completed-work',
    JSON.stringify(workerCompleted) === JSON.stringify(expectedWorkIds),
    `worker_completed=${workerCompleted.join(',')}`,
  )

  const eventFingerprint = (events) =>
    events.map((event) => `${String(event.seq)}:${event.id}:${event.type}`)
  const apiFingerprint = eventFingerprint(apiEvents)
  const dbFingerprint = eventFingerprint(dbEvents)
  check(
    'api-sqlite-event-parity',
    JSON.stringify(apiFingerprint) === JSON.stringify(dbFingerprint),
    `api=${apiEvents.length} db=${dbEvents.length}`,
  )
  check(
    'fixture-behavior-passed',
    fixtureTestPassed,
    `passed=${String(fixtureTestPassed)}`,
  )

  return { ok: checks.every((item) => item.pass), checks }
}
