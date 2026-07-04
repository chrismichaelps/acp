#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const expectedVariables = new Set([
  'ACP_BASE_URL',
  'ACP_DATABASE_URL',
  'ACP_DEFAULT_LEASE_TTL',
  'ACP_DOGFOOD_PR_URL',
  'ACP_DOGFOOD_RUN_ID',
  'ACP_DOGFOOD_WORKER_ID',
  'ACP_EVENT_RETENTION_DAYS',
  'ACP_LOG_LEVEL',
  'ACP_MAX_ARTIFACT_SIZE_MB',
  'ACP_PORT',
  'ACP_PROFILE',
  'ACP_REQUIRE_AUTH',
  'ACP_RPC_TOKEN',
  'ACP_SESSION_TTL',
  'ACP_SQLITE_PATH',
  'ACP_SSE_HEARTBEAT',
  'ACP_STORAGE_ADAPTER',
  'ACP_SWEEP_INTERVAL',
])

const entries = readFileSync('.env.example', 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line !== '' && !line.startsWith('#'))
  .map((line) => line.split('=', 1)[0])

const variables = new Set(entries)
const duplicates = entries.filter(
  (entry, index) => entries.indexOf(entry) !== index,
)
const missing = [...expectedVariables].filter((key) => !variables.has(key))
const extra = [...variables].filter((key) => !expectedVariables.has(key))

if (duplicates.length > 0 || missing.length > 0 || extra.length > 0) {
  console.error('.env.example is out of sync with the implemented environment.')
  for (const key of duplicates) {
    console.error(`duplicate: ${key}`)
  }
  for (const key of missing) {
    console.error(`missing: ${key}`)
  }
  for (const key of extra) {
    console.error(`extra: ${key}`)
  }
  process.exitCode = 1
}
