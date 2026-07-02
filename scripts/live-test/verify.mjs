#!/usr/bin/env node
// Verifier for the live agent coordination test.
// Reads the workspace event history back TWO independent ways — the shipped `acp`
// CLI (the API) and the SQLite file directly — and asserts the six coordination
// invariants from the design. Exits non-zero if any hard invariant fails.
//
// Usage:
//   ACP_BASE_URL=... ACP_SQLITE_PATH=... \
//   node scripts/live-test/verify.mjs <workspace_id>

import { execFileSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'

const workspaceId = process.argv[2]
if (!workspaceId) {
  console.error('usage: verify.mjs <workspace_id>')
  process.exit(2)
}
const baseUrl = process.env.ACP_BASE_URL ?? 'http://localhost:4318'
const sqlitePath = process.env.ACP_SQLITE_PATH
if (!sqlitePath) {
  console.error('ACP_SQLITE_PATH is required for durability-parity check')
  process.exit(2)
}

const cli = (...args) =>
  execFileSync('node', ['dist/app/cli/main.js', ...args], {
    encoding: 'utf8',
    env: { ...process.env, ACP_BASE_URL: baseUrl },
  })

// --- Readback 1: the API (via the shipped CLI) ------------------------------
// Mint a read-only verifier session so this works under ACP_REQUIRE_AUTH=true.
const session = JSON.parse(
  cli(
    'session',
    'init',
    '--worker',
    'agent_verifier',
    '--name',
    'Verifier',
    '--kind',
    'agent',
    '--permissions',
    'workspace:read,event:read,memory:read',
  ),
)
process.env.ACP_RPC_TOKEN = session.session_id

const apiRaw = cli('events', 'list', '--workspace', workspaceId, '--after', '0')
const apiParsed = JSON.parse(apiRaw)
const apiEvents = Array.isArray(apiParsed)
  ? apiParsed
  : (apiParsed.events ?? apiParsed.items ?? [])

// --- Readback 2: the SQLite file directly -----------------------------------
const db = new DatabaseSync(sqlitePath, { readOnly: true })
const dbRows = db
  .prepare(
    'SELECT seq, value FROM events WHERE workspace_id = ? ORDER BY seq ASC',
  )
  .all(workspaceId)
const dbEvents = dbRows.map((r) => JSON.parse(r.value))
db.close()

// --- Assertions -------------------------------------------------------------
const results = []
const check = (name, pass, detail) => results.push({ name, pass, detail })

const byWork = (evts, type) =>
  evts.filter((e) => e.type === type).map((e) => e.work_id)

// 1. Strictly monotonic, contiguous, append-only seq (from SQLite, the source
//    of truth for ordering).
const seqs = dbEvents.map((e) => e.seq)
const monotonic = seqs.every((s, i) => i === 0 || s > seqs[i - 1])
const contiguous = seqs.every((s, i) => s === i + 1)
check(
  'monotonic-append-only-seq',
  monotonic && contiguous && seqs.length > 0,
  `seq 1..${seqs.length}, monotonic=${monotonic}, contiguous=${contiguous}`,
)

// 2. Real contention: at least one lease was denied to a worker.
const denied = dbEvents.filter((e) => e.type === 'lease.denied')
check(
  'lease-contention-occurred',
  denied.length >= 1,
  `${denied.length} lease.denied event(s)`,
)

// 3. Review loop: for some work unit, review.changes_requested precedes a later
//    review.approved.
const loopWork = new Set(byWork(dbEvents, 'review.changes_requested'))
let loopOk = false
for (const w of loopWork) {
  const cr = dbEvents.find(
    (e) => e.type === 'review.changes_requested' && e.work_id === w,
  )
  const ap = dbEvents.find(
    (e) =>
      e.type === 'review.approved' && e.work_id === w && e.seq > (cr?.seq ?? 0),
  )
  if (cr && ap) loopOk = true
}
check(
  'review-changes-then-approve',
  loopOk,
  loopOk
    ? 'found changes_requested -> later approved for same work'
    : 'no work unit showed changes_requested followed by approval',
)

// 4. Every claimed unit reached a terminal state, and no lease is left active.
const claimed = new Set(byWork(dbEvents, 'work.claimed'))
const completed = new Set(byWork(dbEvents, 'work.completed'))
const terminalTypes = new Set([
  'work.completed',
  'work.cancelled',
  'work.rejected',
])
const claimedTerminal = [...claimed].every((w) =>
  dbEvents.some((e) => terminalTypes.has(e.type) && e.work_id === w),
)
let activeLeases = -1
try {
  const leaseRaw = cli('lease', 'list', '--workspace', workspaceId)
  const leaseParsed = JSON.parse(leaseRaw)
  const leases = Array.isArray(leaseParsed)
    ? leaseParsed
    : (leaseParsed.leases ?? leaseParsed.items ?? [])
  activeLeases = leases.filter((l) => l.state === 'active').length
} catch {
  // leave activeLeases as -1 (unknown) if the lease list read fails
}
check(
  'claimed-work-terminal-and-leases-released',
  claimed.size > 0 && claimedTerminal && activeLeases === 0,
  `claimed=${claimed.size}, completed=${completed.size}, terminal=${claimedTerminal}, activeLeases=${activeLeases}`,
)

// 5. Cross-actor handoff exists: checkpoints + memory were written (by workers)
//    and are readable via the API for a reviewed unit.
const checkpoints = dbEvents.filter((e) => e.type === 'checkpoint.created')
const memories = dbEvents.filter((e) => e.type === 'memory.created')
let memoryReadable = false
const reviewedWork =
  [...loopWork][0] ?? byWork(dbEvents, 'work.needs_review')[0]
if (reviewedWork) {
  try {
    const memRaw = cli(
      'memory',
      'list',
      '--workspace',
      workspaceId,
      '--work',
      reviewedWork,
    )
    const memParsed = JSON.parse(memRaw)
    const mem = Array.isArray(memParsed)
      ? memParsed
      : (memParsed.records ?? memParsed.items ?? [])
    memoryReadable = mem.length >= 0 // reachable + parseable
  } catch {
    memoryReadable = false
  }
}
check(
  'cross-actor-handoff-present',
  checkpoints.length >= 1 && memories.length >= 1 && memoryReadable,
  `checkpoints=${checkpoints.length}, memories=${memories.length}, memoryApiReadable=${memoryReadable}`,
)

// 6. Durability parity: API readback and SQLite readback agree on count + last seq.
const apiSeqs = apiEvents.map((e) => e.seq).filter((s) => typeof s === 'number')
const apiMax = apiSeqs.length ? Math.max(...apiSeqs) : -1
const dbMax = seqs.length ? Math.max(...seqs) : -1
check(
  'api-sqlite-durability-parity',
  apiEvents.length === dbEvents.length && apiMax === dbMax,
  `apiCount=${apiEvents.length} dbCount=${dbEvents.length} apiMaxSeq=${apiMax} dbMaxSeq=${dbMax}`,
)

// --- Report -----------------------------------------------------------------
console.log(`\nLive coordination verification — workspace ${workspaceId}`)
console.log('='.repeat(64))
let allPass = true
for (const r of results) {
  const tag = r.pass ? 'PASS' : 'FAIL'
  if (!r.pass) allPass = false
  console.log(`[${tag}] ${r.name}\n        ${r.detail}`)
}
console.log('='.repeat(64))
console.log(
  `${results.filter((r) => r.pass).length}/${results.length} invariants held.`,
)
console.log(`total events: ${dbEvents.length}`)
process.exit(allPass ? 0 : 1)
