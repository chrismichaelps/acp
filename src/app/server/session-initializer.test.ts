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
import { Timestamp, WorkerId } from '../../protocol/schema/index.js'
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
  maxWorkDepth: 10,
  policyFile: Option.none(),
  hooksFile: Option.none(),
  sandboxAdapter: 'none' as const,
  sandboxImage: Option.none(),
  sandboxRuntime: Option.none(),
  workspaceRoot: Option.none(),
  maxArtifactSizeBytes: 16 * 1024 * 1024,
  sseHeartbeat: Duration.seconds(15),
  sessionTtl: Duration.hours(1),
  sweepInterval: Duration.seconds(60),
  requireAuth: false,
  requireWorkspaceBindings: false,
  requireWorkerSignatures: false,
  workerRegistrationTtl: Duration.hours(24),
  sessionIssuer: 'trusted-client' as const,
  sessionIssuancePolicy: Option.none(),
  metricsToken: Option.none(),
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

describe('initializeSession — registration TTL', () => {
  it('stamps a registration deadline from the configured TTL', async () => {
    const stored = await Effect.runPromise(
      Effect.gen(function* () {
        yield* initializeSession(payload(), '')
        const workers = yield* WorkerService
        return yield* workers.get(
          Schema.decodeUnknownSync(WorkerId)('agent_requested'),
        )
      }).pipe(Effect.provide(Runtime)),
    )
    const worker = Option.getOrThrow(stored)
    expect(Option.isSome(worker.expires_at)).toBe(true)
  })

  it('lapses that registration once the deadline passes, keeping the row', async () => {
    // The deadline comes from the handshake, not the test; a far-future sweep
    // stands in for elapsed time. This is the half ADR-0024 was missing: expiry
    // was swept but nothing ever set a deadline.
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* initializeSession(payload(), '')
        const workers = yield* WorkerService
        const id = Schema.decodeUnknownSync(WorkerId)('agent_requested')
        const lapsed = yield* workers.expireLapsed(
          Schema.decodeUnknownSync(Timestamp)('2099-01-01T00:00:00Z'),
        )
        const after = yield* workers.get(id)
        return { lapsed, worker: Option.getOrThrow(after) }
      }).pipe(Effect.provide(Runtime)),
    )
    expect(result.lapsed.map((w) => w.id)).toEqual(['agent_requested'])
    expect(result.worker.status).toBe('offline')
    expect(Option.isSome(result.worker.expires_at)).toBe(true)
  })

  it('does not lapse a registration that is still live', async () => {
    const lapsed = await Effect.runPromise(
      Effect.gen(function* () {
        yield* initializeSession(payload(), '')
        const workers = yield* WorkerService
        return yield* workers.expireLapsed(
          Schema.decodeUnknownSync(Timestamp)('2020-01-01T00:00:00Z'),
        )
      }).pipe(Effect.provide(Runtime)),
    )
    expect(lapsed).toEqual([])
  })
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
