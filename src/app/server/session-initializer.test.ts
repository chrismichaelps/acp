/** @Acp.App.Server.SessionInitializer.Test — shared initialization transaction */
import { describe, expect, it } from 'vitest'
import { Duration, Effect, Layer, Option, Schema } from 'effect'
import { AppConfigTag } from '../../config/app-config.js'
import {
  SessionService,
  SessionServiceLive,
  TrustedClientSessionIssuerLive,
} from '../../domain/sessions/index.js'
import { WorkerService, WorkerServiceLive } from '../../domain/workers/index.js'
import { InMemoryStorageLive } from '../../infrastructure/storage/index.js'
import { InitializeSessionPayload } from '../../infrastructure/http/index.js'
import { WorkerId } from '../../protocol/schema/index.js'
import { IdClockLive } from './identity.js'
import { initializeSession } from './session-initializer.js'

const ConfigLive = Layer.succeed(AppConfigTag, {
  profile: 'local' as const,
  port: 4317,
  logLevel: 'info' as const,
  storageAdapter: 'memory' as const,
  eventBroker: 'in-process' as const,
  sqlitePath: 'acp.sqlite',
  databaseUrl: Option.none(),
  defaultLeaseTtl: Duration.minutes(15),
  eventRetentionDays: 30,
  maxArtifactSizeBytes: 16 * 1024 * 1024,
  sseHeartbeat: Duration.seconds(15),
  sessionTtl: Duration.hours(1),
  sweepInterval: Duration.seconds(60),
  requireAuth: false,
  requireWorkspaceBindings: false,
  sessionIssuer: 'trusted-client' as const,
  sessionIssuancePolicy: Option.none(),
})

const Runtime = Layer.mergeAll(
  ConfigLive,
  IdClockLive,
  TrustedClientSessionIssuerLive,
  WorkerServiceLive.pipe(Layer.provide(InMemoryStorageLive)),
  SessionServiceLive.pipe(Layer.provide(InMemoryStorageLive)),
)

const payload = (protocolVersion = '0.1') =>
  Schema.decodeUnknownSync(InitializeSessionPayload)({
    protocol_version: protocolVersion,
    worker: {
      id: 'agent_requested',
      name: 'Requested agent',
      kind: 'agent',
    },
    capabilities: { can_edit_files: true, supports_leases: true },
    permissions: ['work:create'],
  })

describe('initializeSession', () => {
  it('normalizes, registers, and stores the exact trusted-client grant', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const response = yield* initializeSession(payload(), '')
        const workers = yield* WorkerService
        const sessions = yield* SessionService
        return {
          response,
          worker: yield* workers.get(
            Schema.decodeUnknownSync(WorkerId)('agent_requested'),
          ),
          session: yield* sessions.get(response.session_id),
        }
      }).pipe(Effect.provide(Runtime)),
    )

    expect(result.response.session_id).toMatch(/^session_[0-9a-f]{64}$/)
    expect(Option.getOrThrow(result.worker).capabilities).toEqual([
      'can_edit_files',
      'supports_leases',
    ])
    const stored = Option.getOrThrow(result.session)
    expect(stored.permissions).toEqual(result.response.permissions)
    expect(stored.workspace_ids).toEqual(result.response.workspace_ids)
    expect(Option.isNone(stored.issuance)).toBe(true)
  })

  it('rejects unsupported protocol before registering a worker or session', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const denied = yield* Effect.either(
          initializeSession(payload('0.2'), ''),
        )
        const workers = yield* WorkerService
        const sessions = yield* SessionService
        return {
          denied,
          workers: yield* workers.list(),
          sessions: yield* sessions.list(),
        }
      }).pipe(Effect.provide(Runtime)),
    )

    expect(result.denied._tag).toBe('Left')
    expect(result.workers).toEqual([])
    expect(result.sessions).toEqual([])
  })
})
