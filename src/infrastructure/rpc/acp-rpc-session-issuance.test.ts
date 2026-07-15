/** @Acp.Infra.Rpc.SessionIssuance.Test — native hostile-client issuance */
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { Duration, Effect, Either, Layer, Option } from 'effect'
import { AppLive } from '../../app/index.js'
import { IdClockLive } from '../../app/server/identity.js'
import { AppConfigTag } from '../../config/app-config.js'
import { SessionIssuerLive } from '../auth/index.js'
import { InMemoryStorageLive } from '../storage/index.js'
import { AcpRpcGroup } from './acp-rpc-contract.js'
import { AcpRpcSessionWorkerWorkspaceHandlersLive } from './acp-rpc-handlers.js'
import { bearer, decodePayload, rpcOptions } from './acp-rpc-test-support.js'
import { InitializeSessionPayload } from '../http/index.js'

const credential = 'native-issuance-secret'
const policy = JSON.stringify({
  issuer_id: 'issuer_native',
  principals: [
    {
      id: 'principal_native',
      revision: '1',
      enabled: true,
      credential_sha256: createHash('sha256').update(credential).digest('hex'),
      worker: {
        id: 'agent_policy_native',
        name: 'Policy native agent',
        kind: 'ci',
        status: 'online',
        capabilities: ['can_run_commands'],
      },
      permissions: ['worker:read'],
      workspace_ids: ['workspace_native'],
    },
  ],
})

const StaticConfigLive = Layer.succeed(AppConfigTag, {
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
  requireAuth: true,
  requireWorkspaceBindings: true,
  sessionIssuer: 'static' as const,
  sessionIssuancePolicy: Option.some(policy),
})

const StaticIssuerLive = SessionIssuerLive.pipe(
  Layer.provide(Layer.merge(StaticConfigLive, InMemoryStorageLive)),
)

const Runtime = AcpRpcSessionWorkerWorkspaceHandlersLive.pipe(
  Layer.provide(
    Layer.mergeAll(AppLive, IdClockLive, StaticConfigLive, StaticIssuerLive),
  ),
)

const hostilePayload = decodePayload(InitializeSessionPayload, {
  worker: {
    id: 'agent_hostile_native',
    name: 'Hostile native agent',
    kind: 'agent',
  },
  capabilities: { can_create_prs: true },
  permissions: ['review:approve'],
  workspace_ids: ['workspace_hostile'],
})

describe('native RPC static session issuance', () => {
  it('denies missing and incorrect issuance credentials identically', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const initialize =
          yield* AcpRpcGroup.accessHandler('session.initialize')
        const payload = yield* hostilePayload
        const missing = yield* Effect.either(initialize(payload, rpcOptions()))
        const wrong = yield* Effect.either(
          initialize(payload, rpcOptions(bearer('wrong-secret'))),
        )
        return { missing, wrong }
      }).pipe(Effect.provide(Runtime)),
    )

    expect(Either.isLeft(result.missing)).toBe(true)
    expect(Either.isLeft(result.wrong)).toBe(true)
    if (Either.isLeft(result.missing) && Either.isLeft(result.wrong)) {
      expect(result.missing.left).toEqual(result.wrong.left)
      expect(result.missing.left.error.code).toBe('unauthorized')
    }
  })

  it('returns and authorizes only the static policy grant', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const initialize =
          yield* AcpRpcGroup.accessHandler('session.initialize')
        const workerList = yield* AcpRpcGroup.accessHandler('worker.list')
        const payload = yield* hostilePayload
        const session = yield* initialize(
          payload,
          rpcOptions(bearer(credential)),
        )
        const workers = yield* workerList(
          undefined,
          rpcOptions(bearer(session.session_id)),
        )
        return { session, workers }
      }).pipe(Effect.provide(Runtime)),
    )

    expect(result.session.permissions).toEqual(['worker:read'])
    expect(Option.getOrThrow(result.session.workspace_ids)).toEqual([
      'workspace_native',
    ])
    expect(result.workers.map((worker) => worker.id)).toEqual([
      'agent_policy_native',
    ])
  })
})
