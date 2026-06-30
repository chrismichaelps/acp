/** @Acp.Infra.Rpc.Handlers.Test — first native RPC handler vertical */
import { Headers } from '@effect/platform'
import { Effect, Either, Layer, Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import { AppLive } from '../../app/index.js'
import { IdClockLive } from '../../app/server/identity.js'
import type { WorkerId } from '../../protocol/schema/index.js'
import {
  InitializeSessionPayload,
  type InitializeSessionPayload as InitializeSessionPayloadType,
} from '../http/acp-http-api.js'
import { AcpRpcGroup } from './acp-rpc-contract.js'
import { AcpRpcSessionWorkerWorkspaceHandlersLive } from './acp-rpc-handlers.js'

const Runtime = AcpRpcSessionWorkerWorkspaceHandlersLive.pipe(
  Layer.provide(Layer.mergeAll(AppLive, IdClockLive)),
)

const decodeInitialize = (
  permissions: InitializeSessionPayloadType['permissions'],
) =>
  Schema.decodeUnknown(InitializeSessionPayload)({
    worker: {
      id: 'agent_rpc',
      name: 'RPC Agent',
      kind: 'agent',
    },
    capabilities: {
      can_edit_files: true,
      can_run_commands: false,
      can_create_prs: false,
      can_review: false,
      supports_checkpoints: false,
      supports_leases: false,
    },
    permissions,
  })

const bearer = (sessionId: string) =>
  Headers.fromInput({ authorization: `Bearer ${sessionId}` })

const rpcOptions = (headers = Headers.empty) =>
  // Runtime accessHandler forwards this options object; 0.75.1's d.ts narrows it to Headers.
  ({ clientId: 0, headers }) as unknown as Headers.Headers

describe('AcpRpcSessionWorkerWorkspaceHandlersLive', () => {
  it('initializes a session and serves scoped worker/workspace reads', async () => {
    const program = Effect.gen(function* () {
      const initialize = yield* AcpRpcGroup.accessHandler('session.initialize')
      const workerList = yield* AcpRpcGroup.accessHandler('worker.list')
      const workerGet = yield* AcpRpcGroup.accessHandler('worker.get')
      const workspaceList = yield* AcpRpcGroup.accessHandler('workspace.list')

      const payload = yield* decodeInitialize(['worker:read', 'workspace:read'])
      const session = yield* initialize(payload, rpcOptions())
      const headers = bearer(session.session_id)
      const workers = yield* workerList(undefined, rpcOptions(headers))
      const worker = yield* workerGet(
        { worker_id: 'agent_rpc' as WorkerId },
        rpcOptions(headers),
      )
      const workspaces = yield* workspaceList(undefined, rpcOptions(headers))

      return { session, worker, workers, workspaces }
    })

    const result = await Effect.runPromise(Effect.provide(program, Runtime))
    expect(result.session.host).toEqual({ name: 'ACP Local', kind: 'local' })
    expect(result.worker.id).toBe('agent_rpc')
    expect(result.worker.capabilities).toEqual(['can_edit_files'])
    expect(result.workers.map((worker) => worker.id)).toContain('agent_rpc')
    expect(result.workspaces).toEqual([])
  })

  it('returns a typed ACP error when the session lacks a read scope', async () => {
    const program = Effect.gen(function* () {
      const initialize = yield* AcpRpcGroup.accessHandler('session.initialize')
      const workerList = yield* AcpRpcGroup.accessHandler('worker.list')
      const payload = yield* decodeInitialize([])
      const session = yield* initialize(payload, rpcOptions())
      return yield* Effect.either(
        workerList(undefined, rpcOptions(bearer(session.session_id))),
      )
    })

    const result = await Effect.runPromise(Effect.provide(program, Runtime))
    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) {
      expect(result.left.error.code).toBe('unauthorized')
    }
  })
})
