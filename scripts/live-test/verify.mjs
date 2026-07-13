#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { evaluateLiveAgentRun } from './verify-support.mjs'

const workspaceId = process.argv[2]
const sqlitePath = process.env.ACP_SQLITE_PATH
const workRepo = process.env.WORK_REPO
const resultDir = process.env.ACP_LIVE_RESULT_DIR
if (!workspaceId || !sqlitePath || !workRepo || !resultDir) {
  console.error(
    'usage: ACP_SQLITE_PATH=... WORK_REPO=... ACP_LIVE_RESULT_DIR=... verify.mjs <workspace_id>',
  )
  process.exit(2)
}

const baseUrl = process.env.ACP_BASE_URL ?? 'http://localhost:4318'
const cliPath = process.env.ACP_CLI ?? 'dist/app/cli/main.js'
const cli = (token, ...args) =>
  execFileSync('node', [cliPath, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ACP_BASE_URL: baseUrl,
      ...(token === '' ? {} : { ACP_RPC_TOKEN: token }),
    },
  })
const parseList = (raw) => {
  const value = JSON.parse(raw)
  if (Array.isArray(value)) return value
  return value.items ?? value.events ?? value.records ?? value.leases ?? []
}

const session = JSON.parse(
  cli(
    '',
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
    '--workspace',
    workspaceId,
  ),
)
const token = session.session_id
const apiEvents = parseList(
  cli(token, 'events', 'list', '--workspace', workspaceId, '--after', '0'),
)
const workItems = parseList(
  cli(token, 'work', 'list', '--workspace', workspaceId),
)
const leases = parseList(
  cli(token, 'lease', 'list', '--workspace', workspaceId),
)
const memoriesByWork = Object.fromEntries(
  workItems.map((work) => [
    work.id,
    parseList(
      cli(
        token,
        'memory',
        'list',
        '--workspace',
        workspaceId,
        '--work',
        work.id,
      ),
    ),
  ]),
)

const db = new DatabaseSync(sqlitePath, { readOnly: true })
const dbEvents = db
  .prepare('SELECT value FROM events WHERE workspace_id = ? ORDER BY seq ASC')
  .all(workspaceId)
  .map((row) => JSON.parse(row.value))
db.close()

let fixtureTestPassed = true
try {
  execFileSync('node', ['test.mjs'], { cwd: workRepo, stdio: 'pipe' })
} catch {
  fixtureTestPassed = false
}
const readResult = (name) =>
  JSON.parse(readFileSync(join(resultDir, `${name}.json`), 'utf8'))
const roleResults = {
  planner: readResult('planner'),
  workers: [readResult('worker-a'), readResult('worker-b')],
  reviewer: readResult('reviewer'),
}
const result = evaluateLiveAgentRun({
  apiEvents,
  dbEvents,
  fixtureTestPassed,
  leases,
  memoriesByWork,
  roleResults,
  sharedProbeUri: `file://${workRepo}/src/shared.js`,
  workItems,
  workspaceId,
})

for (const item of result.checks) {
  console.log(`[${item.pass ? 'PASS' : 'FAIL'}] ${item.name}: ${item.detail}`)
}
const report = {
  ok: result.ok,
  workspace_id: workspaceId,
  event_count: dbEvents.length,
  checks: result.checks,
}
const reportPath = process.env.ACP_LIVE_REPORT_PATH
if (reportPath)
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
process.exit(result.ok ? 0 : 1)
