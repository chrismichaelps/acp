#!/usr/bin/env node
// Sets up an isolated run dir for the live agent coordination test.
// Never deletes anything outside its own run dir. Idempotent per run id.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const runId = process.argv[2] ?? 'local'
const base = process.env.ACP_LIVE_TEST_DIR ?? join(tmpdir(), 'acp-live-test')
const runDir = join(base, runId)
const hostDir = join(runDir, 'host')
const workRepo = join(runDir, 'work-repo')
const sqlitePath = join(hostDir, 'acp.sqlite')

for (const dir of [runDir, hostDir, join(workRepo, 'src')]) {
  mkdirSync(dir, { recursive: true })
}

const git = (...args) =>
  execFileSync('git', ['-C', workRepo, ...args], { stdio: 'pipe' })

if (!existsSync(join(workRepo, '.git'))) {
  git('init', '-q')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'ACP Test')
}

// task-a: a real bug to fix
writeFileSync(
  join(workRepo, 'src/util-a.js'),
  'export function add(a, b) {\n  return a - b; // BUG: should be +\n}\n',
)
// task-b: a helper to add
writeFileSync(
  join(workRepo, 'src/util-b.js'),
  'export const helpers = {\n  // TODO: add capitalize helper\n};\n',
)
// task-shared: the file BOTH workers will want -> forces a lease conflict
writeFileSync(
  join(workRepo, 'src/shared.js'),
  'export const VERSION = "0.0.0"; // needs bump\n',
)

git('add', '-A')
try {
  git('commit', '-q', '-m', `scratch state (${runId})`)
} catch {
  // nothing to commit on a re-run — fine
}

const env = {
  RUN_DIR: runDir,
  WORK_REPO: workRepo,
  SQLITE_PATH: sqlitePath,
  WORKSPACE_URI: `file://${workRepo}`,
}

console.log(JSON.stringify(env, null, 2))
