#!/usr/bin/env node
/**
 * Backup & restore self-dogfood scenario (issue #331 operational contracts).
 *
 * Proves the backup/restore runbook end-to-end against real containers:
 *   - SQLite: an online backup (node:sqlite `backup()`, the SQLite backup API)
 *     taken while writes are in flight is a consistent point-in-time copy
 *     (PRAGMA integrity_check == ok) and restores into a fresh store that still
 *     serves the seeded state.
 *   - Postgres: `pg_dump` taken under concurrent writes restores via
 *     `pg_restore` into a fresh database that still serves the seeded state.
 *
 * The Postgres branch is skipped automatically when the platform cannot run the
 * postgres image; the SQLite branch always runs.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { setTimeout as delay } from 'node:timers/promises'
import { spawn } from 'node:child_process'
import {
  assert,
  docker,
  dockerOk,
  expectOk,
  initAgent,
  makeCli,
  waitForReady,
} from './acp-docker-self-support.mjs'

const image = process.env.ACP_DOCKER_IMAGE ?? 'acp:docker-self-dogfood'
const runId = process.env.ACP_DOGFOOD_RUN_ID ?? 'backup'
const SQLITE_PATH = '/data/acp.sqlite'

const narrate = (message) => console.log(`[ACP backup] ${message}`)

const runVisible = (command, args, env = {}) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: 'inherit',
    })
    child.on('error', rejectPromise)
    child.on('close', (code) => {
      if (code === 0) resolvePromise()
      else
        rejectPromise(new Error(`${command} ${args.join(' ')} exited ${code}`))
    })
  })

const rm = (args) => docker(args).catch(() => undefined)

// Seed a workspace + work + a checkpoint, returning the ids and the reusable
// session token (sessions persist in the store, so the token survives a
// backup/restore into a fresh host).
const seedState = async (container, label) => {
  const cli = makeCli(container)
  const agent = await initAgent(cli, `backup_${label}`, runId)
  const workspace = await expectOk(
    cli,
    `${label} workspace create`,
    agent.token,
    [
      'workspace',
      'create',
      '--name',
      `ACP backup ${label} ${runId}`,
      '--kind',
      'git_repository',
      '--uri',
      `file:///workspace/acp-backup-${label}-${runId}`,
      '--default-branch',
      'main',
    ],
  )
  const work = await expectOk(cli, `${label} work create`, agent.token, [
    'work',
    'create',
    'Survive a backup and restore',
    '--workspace',
    workspace.id,
    '--priority',
    'high',
  ])
  await expectOk(cli, `${label} work claim`, agent.token, [
    'work',
    'claim',
    work.id,
    '--worker',
    agent.worker,
  ])
  await expectOk(cli, `${label} work running`, agent.token, [
    'work',
    'update',
    work.id,
    '--state',
    'running',
  ])
  // Commit a checkpoint before any backup is taken, so the restored store has
  // deterministic state to verify. The concurrent-write loop adds more later.
  await expectOk(cli, `${label} seed checkpoint`, agent.token, [
    'checkpoint',
    'create',
    '--workspace',
    workspace.id,
    '--work',
    work.id,
    '--summary',
    'seed checkpoint before backup',
  ])
  return { cli, agent, workspace, work }
}

// Fire a continuous stream of appends (checkpoints) against the running host so
// the backup is taken with writes genuinely in flight, then resolve once done.
const writesInFlight = (cli, token, workspace, work, label, rounds = 12) =>
  (async () => {
    for (let i = 0; i < rounds; i += 1) {
      await expectOk(cli, `${label} concurrent checkpoint ${i}`, token, [
        'checkpoint',
        'create',
        '--workspace',
        workspace.id,
        '--work',
        work.id,
        '--summary',
        `concurrent-write ${i}`,
      ])
    }
  })()

// Assert the restored host still serves the seeded state under a reused token.
const assertRestored = async (container, seed, label) => {
  const cli = makeCli(container)
  const resumed = await expectOk(
    cli,
    `${label} work resume`,
    seed.agent.token,
    ['work', 'resume', seed.work.id],
  )
  assert(
    resumed.work.state === 'running',
    `${label}: restored work was not running (${JSON.stringify(resumed.work.state)})`,
  )
  assert(
    resumed.latest_checkpoint !== undefined &&
      resumed.latest_checkpoint !== null,
    `${label}: restored work lost its checkpoints`,
  )
  const events = await expectOk(cli, `${label} events list`, seed.agent.token, [
    'events',
    'list',
    '--workspace',
    seed.workspace.id,
    '--after',
    '0',
  ])
  assert(events.length > 0, `${label}: restored store replayed no events`)
  return { work_state: resumed.work.state, event_count: events.length }
}

const runSqliteBackup = async (hostDir) => {
  const seedContainer = `acp-backup-sqlite-seed-${runId}`
  const seedVolume = `${seedContainer}-data`
  const restoreContainer = `acp-backup-sqlite-restore-${runId}`
  const restoreVolume = `${restoreContainer}-data`
  const backupInContainer = '/tmp/acp-backup.sqlite'
  const hostBackup = join(hostDir, 'acp-backup.sqlite')

  const runHost = (name, volume) =>
    dockerOk([
      'run',
      '-d',
      '--name',
      name,
      '-e',
      'ACP_STORAGE_ADAPTER=sqlite',
      '-e',
      `ACP_SQLITE_PATH=${SQLITE_PATH}`,
      '-v',
      `${volume}:/data`,
      image,
    ])

  const cleanup = async () => {
    await rm(['rm', '-f', seedContainer])
    await rm(['rm', '-f', restoreContainer])
    await rm(['volume', 'rm', seedVolume])
    await rm(['volume', 'rm', restoreVolume])
  }

  await cleanup()
  try {
    narrate('SQLite: booting the seed host.')
    await dockerOk(['volume', 'create', seedVolume])
    await runHost(seedContainer, seedVolume)
    await waitForReady(seedContainer)
    const seed = await seedState(seedContainer, 'sqlite')

    narrate('SQLite: taking an online backup while writes are in flight.')
    const backupScript = `
import { DatabaseSync, backup } from 'node:sqlite'
const source = new DatabaseSync('${SQLITE_PATH}')
const pages = await backup(source, '${backupInContainer}')
source.close()
console.log(JSON.stringify({ pages }))
`
    const [, backupOut] = await Promise.all([
      writesInFlight(
        seed.cli,
        seed.agent.token,
        seed.workspace,
        seed.work,
        'sqlite',
      ),
      dockerOk([
        'exec',
        seedContainer,
        'node',
        '--input-type=module',
        '-e',
        backupScript,
      ]),
    ])
    assert(JSON.parse(backupOut).pages > 0, 'SQLite backup copied no pages')

    await dockerOk(['cp', `${seedContainer}:${backupInContainer}`, hostBackup])

    narrate(
      'SQLite: verifying the snapshot is a consistent point-in-time copy.',
    )
    const snapshot = new DatabaseSync(hostBackup, { readOnly: true })
    const integrity = snapshot.prepare('PRAGMA integrity_check').get()
    assert(
      integrity.integrity_check === 'ok',
      `SQLite snapshot failed integrity_check: ${JSON.stringify(integrity)}`,
    )
    const workRow = snapshot
      .prepare("SELECT value FROM kv WHERE collection = 'work' AND id = ?")
      .get(seed.work.id)
    assert(
      workRow !== undefined && JSON.parse(workRow.value).id === seed.work.id,
      'SQLite snapshot did not contain the seeded work row',
    )
    snapshot.close()

    narrate('SQLite: restoring the snapshot into a fresh volume.')
    await rm(['rm', '-f', seedContainer])
    await dockerOk(['volume', 'create', restoreVolume])
    // Seed the fresh volume from the backup, owned by the runtime `node` user so
    // the host can open it read-write on boot.
    await dockerOk([
      'run',
      '--rm',
      '-u',
      '0',
      '-v',
      `${restoreVolume}:/data`,
      '-v',
      `${hostDir}:/backup:ro`,
      image,
      'sh',
      '-c',
      `cp /backup/acp-backup.sqlite ${SQLITE_PATH} && chown node:node ${SQLITE_PATH}`,
    ])
    await runHost(restoreContainer, restoreVolume)
    await waitForReady(restoreContainer)
    const restored = await assertRestored(restoreContainer, seed, 'sqlite')
    narrate(
      `SQLite: restored store serves work=${restored.work_state}, events=${String(restored.event_count)}.`,
    )
    return { ok: true, adapter: 'sqlite', ...restored }
  } finally {
    await cleanup()
  }
}

const postgresAvailable = async () => {
  const result = await docker(['pull', 'postgres:16-alpine'])
  return result.ok
}

const runPostgresBackup = async (hostDir) => {
  const net = `acp-backup-net-${runId}`
  const pg = `acp-backup-pg-seed-${runId}`
  const pg2 = `acp-backup-pg-restore-${runId}`
  const acp = `acp-backup-pg-host-${runId}`
  const acp2 = `acp-backup-pg-host2-${runId}`
  const dumpInContainer = '/tmp/acp.dump'
  const hostDump = join(hostDir, 'acp.dump')
  const dbUrl = (host) => `postgres://acp:acp@${host}:5432/acp`

  const cleanup = async () => {
    await rm(['rm', '-f', acp])
    await rm(['rm', '-f', acp2])
    await rm(['rm', '-f', pg])
    await rm(['rm', '-f', pg2])
    await rm(['network', 'rm', net])
  }

  const runPg = (name) =>
    dockerOk([
      'run',
      '-d',
      '--name',
      name,
      '--network',
      net,
      '-e',
      'POSTGRES_USER=acp',
      '-e',
      'POSTGRES_PASSWORD=acp',
      '-e',
      'POSTGRES_DB=acp',
      'postgres:16-alpine',
    ])

  // The official postgres image boots a temporary init server (which briefly
  // accepts connections) and then shuts it down to start the real server. A
  // single `pg_isready` can latch onto that init server and a later command
  // then hits "the database system is shutting down". Require several
  // consecutive live-query successes so the brief init window cannot satisfy us.
  const waitForPg = async (name) => {
    const deadline = Date.now() + 60_000
    let streak = 0
    for (;;) {
      const result = await docker(
        ['exec', name, 'psql', '-U', 'acp', '-d', 'acp', '-tAc', 'SELECT 1'],
        { timeoutMs: 10_000 },
      ).catch(() => ({ ok: false }))
      streak = result.ok ? streak + 1 : 0
      if (streak >= 3) return
      if (Date.now() >= deadline) throw new Error(`${name} never became ready`)
      await delay(500)
    }
  }

  // A `/ready` poll with a bounded per-exec timeout, so a transiently-blocked
  // `docker exec` is killed and retried rather than hanging on the default
  // 180s process timeout.
  const waitForAcp = async (name) => {
    const deadline = Date.now() + 90_000
    for (;;) {
      const result = await docker(
        [
          'exec',
          name,
          'node',
          '-e',
          "fetch('http://127.0.0.1:4317/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))",
        ],
        { timeoutMs: 10_000 },
      ).catch(() => ({ ok: false }))
      if (result.ok) return
      if (Date.now() >= deadline) {
        const logs = await docker(['logs', '--tail', '50', name]).catch(() => ({
          stdout: '',
          stderr: '',
        }))
        throw new Error(
          `${name} never became ready: ${logs.stderr || logs.stdout}`,
        )
      }
      await delay(500)
    }
  }

  const runAcp = (name, host) =>
    dockerOk([
      'run',
      '-d',
      '--name',
      name,
      '--network',
      net,
      '-e',
      'ACP_STORAGE_ADAPTER=postgres',
      '-e',
      `ACP_DATABASE_URL=${dbUrl(host)}`,
      image,
    ])

  await cleanup()
  try {
    narrate('Postgres: booting Postgres + the seed host.')
    await dockerOk(['network', 'create', net])
    await runPg(pg)
    await waitForPg(pg)
    await runAcp(acp, pg)
    await waitForAcp(acp)
    const seed = await seedState(acp, 'postgres')

    narrate('Postgres: running pg_dump while writes are in flight.')
    await Promise.all([
      writesInFlight(
        seed.cli,
        seed.agent.token,
        seed.workspace,
        seed.work,
        'postgres',
      ),
      dockerOk([
        'exec',
        pg,
        'pg_dump',
        '-U',
        'acp',
        '-Fc',
        '-d',
        'acp',
        '-f',
        dumpInContainer,
      ]),
    ])
    await dockerOk(['cp', `${pg}:${dumpInContainer}`, hostDump])

    narrate('Postgres: restoring the dump into a fresh database.')
    await rm(['rm', '-f', acp])
    await runPg(pg2)
    await waitForPg(pg2)
    await dockerOk(['cp', hostDump, `${pg2}:${dumpInContainer}`])
    await dockerOk([
      'exec',
      pg2,
      'pg_restore',
      '-U',
      'acp',
      '-d',
      'acp',
      '--no-owner',
      dumpInContainer,
    ])
    await runAcp(acp2, pg2)
    await waitForAcp(acp2)
    const restored = await assertRestored(acp2, seed, 'postgres')
    narrate(
      `Postgres: restored store serves work=${restored.work_state}, events=${String(restored.event_count)}.`,
    )
    return { ok: true, adapter: 'postgres', ...restored }
  } finally {
    await cleanup()
  }
}

export const runBackupScenario = async ({ skipBuild = false } = {}) => {
  if (skipBuild) narrate('Reusing the ACP image built by the runner.')
  else {
    narrate('Building the ACP image.')
    await runVisible('docker', ['build', '-t', image, '.'])
  }

  const hostDir = mkdtempSync(join(tmpdir(), 'acp-backup-'))
  try {
    const sqlite = await runSqliteBackup(hostDir)
    let postgres = { ok: false, adapter: 'postgres', skipped: true }
    if (await postgresAvailable()) {
      postgres = await runPostgresBackup(hostDir)
    } else {
      narrate('Postgres image unavailable; skipping the Postgres branch.')
    }
    const result = { ok: true, run_id: runId, image, sqlite, postgres }
    console.log(JSON.stringify(result, null, 2))
    return result
  } finally {
    rmSync(hostDir, { recursive: true, force: true })
  }
}

const entryPath = process.argv[1]
if (
  entryPath !== undefined &&
  pathToFileURL(entryPath).href === import.meta.url
) {
  await runBackupScenario({
    skipBuild: process.env.ACP_DOCKER_SKIP_BUILD === 'true',
  })
}
