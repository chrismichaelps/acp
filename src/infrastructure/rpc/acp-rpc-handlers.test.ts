/** @Acp.Infra.Rpc.Handlers.Test — native RPC domain handlers */
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
import { AcpRpcs } from './acp-rpc-contract.js'
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

const decodePayload = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  input: unknown,
) => Schema.decodeUnknown(schema)(input)

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

  it('runs workspace and work command handlers directly', async () => {
    const program = Effect.gen(function* () {
      const initialize = yield* AcpRpcGroup.accessHandler('session.initialize')
      const workspaceCreate =
        yield* AcpRpcGroup.accessHandler('workspace.create')
      const workspaceUpdate =
        yield* AcpRpcGroup.accessHandler('workspace.update')
      const workspaceArchive =
        yield* AcpRpcGroup.accessHandler('workspace.archive')
      const workCreate = yield* AcpRpcGroup.accessHandler('work.create')
      const workList = yield* AcpRpcGroup.accessHandler(
        'work.list_for_workspace',
      )
      const workGet = yield* AcpRpcGroup.accessHandler('work.get')
      const workClaim = yield* AcpRpcGroup.accessHandler('work.claim')
      const workUpdate = yield* AcpRpcGroup.accessHandler('work.update_state')
      const workPublish = yield* AcpRpcGroup.accessHandler('work.publish_event')

      const initPayload = yield* decodeInitialize([
        'workspace:read',
        'workspace:write',
        'work:create',
        'work:claim',
        'work:update',
        'work:publish_event',
      ])
      const session = yield* initialize(initPayload, rpcOptions())
      const headers = rpcOptions(bearer(session.session_id))
      const workspacePayload = yield* decodePayload(
        AcpRpcs.workspaceCreate.payloadSchema,
        {
          name: 'RPC Workspace',
          kind: 'git_repository',
          uri: 'git+https://example.com/acp/rpc.git',
        },
      )
      const workspace = yield* workspaceCreate(workspacePayload, headers)
      const updatePayload = yield* decodePayload(
        AcpRpcs.workspaceUpdate.payloadSchema,
        {
          workspace_id: workspace.id,
          name: 'RPC Workspace Updated',
          kind: 'git_repository',
          uri: 'git+https://example.com/acp/rpc-updated.git',
        },
      )
      const updatedWorkspace = yield* workspaceUpdate(updatePayload, headers)
      const workPayload = yield* decodePayload(
        AcpRpcs.workCreate.payloadSchema,
        {
          workspace_id: workspace.id,
          title: 'Wire native RPC handlers',
        },
      )
      const work = yield* workCreate(workPayload, headers)
      const listed = yield* workList({ workspace_id: workspace.id }, headers)
      const fetched = yield* workGet({ work_id: work.id }, headers)
      const claimed = yield* workClaim(
        { work_id: work.id, worker_id: 'agent_rpc' as WorkerId },
        headers,
      )
      const running = yield* workUpdate(
        { work_id: work.id, state: 'running' },
        headers,
      )
      const eventPayload = yield* decodePayload(
        AcpRpcs.workPublishEvent.payloadSchema,
        {
          work_id: work.id,
          type: 'work.progressed',
          data: { message: 'native rpc handler covered' },
        },
      )
      const event = yield* workPublish(eventPayload, headers)
      const archived = yield* workspaceArchive(
        { workspace_id: workspace.id },
        headers,
      )

      return {
        archived,
        claimed,
        event,
        fetched,
        listed,
        running,
        updatedWorkspace,
        work,
        workspace,
      }
    })

    const result = await Effect.runPromise(Effect.provide(program, Runtime))
    expect(result.updatedWorkspace.name).toBe('RPC Workspace Updated')
    expect(result.listed.map((work) => work.id)).toEqual([result.work.id])
    expect(result.fetched.id).toBe(result.work.id)
    expect(result.claimed.state).toBe('claimed')
    expect(result.running.state).toBe('running')
    expect(result.event.type).toBe('work.progressed')
    expect(result.archived.state).toBe('archived')
  })

  it('runs lease lifecycle handlers directly', async () => {
    const program = Effect.gen(function* () {
      const initialize = yield* AcpRpcGroup.accessHandler('session.initialize')
      const workspaceCreate =
        yield* AcpRpcGroup.accessHandler('workspace.create')
      const leaseRequest = yield* AcpRpcGroup.accessHandler('lease.request')
      const leaseRenew = yield* AcpRpcGroup.accessHandler('lease.renew')
      const leaseRelease = yield* AcpRpcGroup.accessHandler('lease.release')
      const leaseRevoke = yield* AcpRpcGroup.accessHandler('lease.revoke')

      const initPayload = yield* decodeInitialize([
        'workspace:write',
        'lease:create',
        'lease:renew',
        'lease:release',
        'lease:revoke',
      ])
      const session = yield* initialize(initPayload, rpcOptions())
      const headers = rpcOptions(bearer(session.session_id))
      const workspace = yield* workspaceCreate(
        yield* decodePayload(AcpRpcs.workspaceCreate.payloadSchema, {
          name: 'RPC Lease Workspace',
          kind: 'git_repository',
          uri: 'git+https://example.com/acp/lease-rpc.git',
        }),
        headers,
      )
      const firstLease = yield* leaseRequest(
        yield* decodePayload(AcpRpcs.leaseRequest.payloadSchema, {
          workspace_id: workspace.id,
          holder: 'agent_rpc',
          resource: { kind: 'file', uri: 'file://src/rpc/lease-a.ts' },
          ttl_seconds: 60,
        }),
        headers,
      )
      const renewed = yield* leaseRenew(
        yield* decodePayload(AcpRpcs.leaseRenew.payloadSchema, {
          lease_id: firstLease.id,
          ttl_seconds: 120,
        }),
        headers,
      )
      const released = yield* leaseRelease({ lease_id: firstLease.id }, headers)
      const secondLease = yield* leaseRequest(
        yield* decodePayload(AcpRpcs.leaseRequest.payloadSchema, {
          workspace_id: workspace.id,
          holder: 'agent_rpc',
          resource: { kind: 'file', uri: 'file://src/rpc/lease-b.ts' },
          ttl_seconds: 60,
        }),
        headers,
      )
      const revoked = yield* leaseRevoke({ lease_id: secondLease.id }, headers)
      yield* leaseRequest(
        yield* decodePayload(AcpRpcs.leaseRequest.payloadSchema, {
          workspace_id: workspace.id,
          holder: 'agent_rpc',
          resource: { kind: 'file', uri: 'file://src/rpc/conflict.ts' },
          ttl_seconds: 60,
        }),
        headers,
      )
      const conflict = yield* Effect.either(
        leaseRequest(
          yield* decodePayload(AcpRpcs.leaseRequest.payloadSchema, {
            workspace_id: workspace.id,
            holder: 'agent_other',
            resource: { kind: 'file', uri: 'file://src/rpc/conflict.ts' },
            ttl_seconds: 60,
          }),
          headers,
        ),
      )

      return { conflict, firstLease, released, renewed, revoked }
    })

    const result = await Effect.runPromise(Effect.provide(program, Runtime))
    expect(result.firstLease.state).toBe('active')
    expect(result.renewed.id).toBe(result.firstLease.id)
    expect(result.released).toBeUndefined()
    expect(result.revoked.state).toBe('revoked')
    expect(Either.isLeft(result.conflict)).toBe(true)
    if (Either.isLeft(result.conflict)) {
      expect(result.conflict.left.error.code).toBe('lease_conflict')
    }
  })
})
