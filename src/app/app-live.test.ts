/** @Acp.App.Live.Test — composed application layer */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach } from 'vitest'
import { describe, expect, it } from 'vitest'
import { Cause, ConfigProvider, Effect, Exit, Option, Schema } from 'effect'
import { AppConfigTag } from '../config/app-config.js'
import { ArtifactService } from '../domain/artifacts/index.js'
import { CheckpointService } from '../domain/checkpoints/index.js'
import { EventStore } from '../domain/events/index.js'
import { LeaseService } from '../domain/leases/index.js'
import { ReviewService } from '../domain/reviews/index.js'
import { WorkUnitService } from '../domain/work-units/index.js'
import { WorkerService } from '../domain/workers/index.js'
import { WorkspaceService } from '../domain/workspaces/index.js'
import { Worker, WorkerId } from '../protocol/schema/index.js'
import { Storage } from '../infrastructure/storage/index.js'
import { AppLive } from './index.js'

const runWithEnv = <A, E>(
  program: Effect.Effect<A, E, WorkerService>,
  env: readonly (readonly [string, string])[],
): A =>
  Effect.runSync(
    Effect.provide(program, AppLive).pipe(
      Effect.withConfigProvider(ConfigProvider.fromMap(new Map(env))),
    ),
  )

const workerId = Schema.decodeUnknownSync(WorkerId)('agent_claude_code')

const worker = Schema.decodeUnknownSync(Worker)({
  id: 'agent_claude_code',
  name: 'Claude Code',
  kind: 'agent',
  vendor: 'anthropic',
  status: 'online',
  capabilities: ['can_edit_files', 'can_review'],
})

describe('AppLive', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('provides the app config, storage, event store, and domain services', () => {
    const tags = Effect.gen(function* () {
      yield* AppConfigTag
      yield* Storage
      yield* EventStore
      yield* WorkUnitService
      yield* WorkerService
      yield* WorkspaceService
      yield* LeaseService
      yield* ArtifactService
      yield* CheckpointService
      yield* ReviewService
      return 'ok' as const
    })

    expect(Effect.runSync(Effect.provide(tags, AppLive))).toBe('ok')
  })

  it('selects SQLite storage and persists domain state across app layer instances', () => {
    const dir = mkdtempSync(join(tmpdir(), 'acp-app-sqlite-'))
    dirs.push(dir)
    const dbPath = join(dir, 'acp.sqlite')
    const env = [
      ['ACP_STORAGE_ADAPTER', 'sqlite'],
      ['ACP_SQLITE_PATH', dbPath],
    ] as const

    runWithEnv(
      Effect.gen(function* () {
        const workers = yield* WorkerService
        yield* workers.register(worker)
      }),
      env,
    )

    const stored = runWithEnv(
      Effect.gen(function* () {
        const workers = yield* WorkerService
        return yield* workers.get(workerId)
      }),
      env,
    )

    expect(Option.getOrNull(stored)?.id).toBe(workerId)
  })

  it('fails fast when pg-notify is selected without a database url', () => {
    const exit = Effect.runSyncExit(
      Effect.provide(EventStore, AppLive).pipe(
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map([['ACP_EVENT_BROKER', 'pg-notify']])),
        ),
      ),
    )
    const failure = Option.getOrNull(
      Option.flatMap(Exit.causeOption(exit), Cause.failureOption),
    )

    if (failure?._tag !== 'StorageError') {
      throw new Error('Expected pg-notify startup to fail with StorageError')
    }
    expect(failure.op).toBe('connect')
    expect(failure.cause).toContain(
      'ACP_DATABASE_URL is required for the pg-notify broker',
    )
  })
})
