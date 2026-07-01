/** @Acp.Infra.Rpc.RoundtripWorkLease.Test — generated client over work/lease methods */
import { RpcTest } from '@effect/rpc'
import { Effect, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { RenewLeasePayload } from '../http/acp-http-api.js'
import type { WorkerId } from '../../protocol/schema/index.js'
import { AcpRpcGroup, AcpRpcs } from './acp-rpc-contract.js'
import { AcpRpcHandlersLive } from './acp-rpc-server.js'
import { decodeInitialize, decodePayload } from './acp-rpc-test-support.js'

describe('native RPC round-trip — worker/workspace/work/lease', () => {
  it('drives worker, workspace, work, and lease methods through the generated client', async () => {
    const program = Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(AcpRpcGroup)

      const session = yield* client.session.initialize(
        yield* decodeInitialize([
          'worker:read',
          'workspace:read',
          'workspace:write',
          'work:create',
          'work:claim',
          'work:update',
          'lease:create',
          'lease:renew',
          'lease:release',
          'lease:revoke',
        ]),
      )
      const auth = { authorization: `Bearer ${session.session_id}` }

      const workers = yield* client.worker.list(undefined, { headers: auth })
      const worker = yield* client.worker.get(
        { worker_id: 'agent_rpc' as WorkerId },
        { headers: auth },
      )

      const workspace = yield* client.workspace.create(
        yield* decodePayload(AcpRpcs.workspaceCreate.payloadSchema, {
          name: 'RPC Work/Lease Round-trip Workspace',
          kind: 'git_repository',
          uri: 'git+https://example.com/acp/work-lease-roundtrip.git',
        }),
        { headers: auth },
      )
      const updated = yield* client.workspace.update(
        yield* decodePayload(AcpRpcs.workspaceUpdate.payloadSchema, {
          workspace_id: workspace.id,
          name: 'RPC Work/Lease Round-trip Workspace (renamed)',
          kind: 'git_repository',
          uri: 'git+https://example.com/acp/work-lease-roundtrip.git',
        }),
        { headers: auth },
      )

      const work = yield* client.work.create(
        yield* decodePayload(AcpRpcs.workCreate.payloadSchema, {
          workspace_id: workspace.id,
          title: 'Round-trip work item',
        }),
        { headers: auth },
      )
      const forWorkspace = yield* client.work.list_for_workspace(
        { workspace_id: workspace.id },
        { headers: auth },
      )
      const fetched = yield* client.work.get(
        { work_id: work.id },
        { headers: auth },
      )
      const claimed = yield* client.work.claim(
        { work_id: work.id, worker_id: 'agent_rpc' as WorkerId },
        { headers: auth },
      )
      const running = yield* client.work.update_state(
        { work_id: work.id, state: 'running' },
        { headers: auth },
      )

      const archived = yield* client.workspace.archive(
        { workspace_id: workspace.id },
        { headers: auth },
      )

      const lease = yield* client.lease.request(
        yield* decodePayload(AcpRpcs.leaseRequest.payloadSchema, {
          workspace_id: workspace.id,
          work_id: work.id,
          holder: 'agent_rpc',
          resource: { kind: 'file', uri: 'file://src/rpc/roundtrip-lease.ts' },
        }),
        { headers: auth },
      )
      const renewParams = yield* decodePayload(RenewLeasePayload, {})
      const renewed = yield* client.lease.renew(
        { lease_id: lease.id, ...renewParams },
        { headers: auth },
      )
      const released = yield* client.lease.release(
        { lease_id: lease.id },
        { headers: auth },
      )
      const releasedLeases = yield* client.lease.list(
        { workspace_id: workspace.id },
        { headers: auth },
      )

      const lease2 = yield* client.lease.request(
        yield* decodePayload(AcpRpcs.leaseRequest.payloadSchema, {
          workspace_id: workspace.id,
          work_id: work.id,
          holder: 'agent_rpc',
          resource: {
            kind: 'file',
            uri: 'file://src/rpc/roundtrip-lease-2.ts',
          },
        }),
        { headers: auth },
      )
      const revoked = yield* client.lease.revoke(
        { lease_id: lease2.id },
        { headers: auth },
      )
      const finalLeases = yield* client.lease.list(
        { workspace_id: workspace.id },
        { headers: auth },
      )

      return {
        archived,
        claimed,
        fetched,
        forWorkspace,
        finalLeases,
        lease,
        released,
        releasedLeases,
        renewed,
        revoked,
        running,
        updated,
        work,
        worker,
        workers,
        workspace,
      }
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(AcpRpcHandlersLive), Effect.scoped),
    )

    expect(result.workers.map((w) => w.id)).toContain(result.worker.id)
    expect(result.updated.name).toBe(
      'RPC Work/Lease Round-trip Workspace (renamed)',
    )
    expect(result.forWorkspace.map((w) => w.id)).toContain(result.work.id)
    expect(result.fetched.id).toBe(result.work.id)
    expect(Option.getOrNull(result.claimed.assigned_to)).toBe('agent_rpc')
    expect(result.running.state).toBe('running')
    expect(result.archived.state).toBe('archived')
    expect(result.renewed.id).toBe(result.lease.id)
    expect(result.released).toBeUndefined()
    expect(
      result.releasedLeases.find((lease) => lease.id === result.lease.id)
        ?.state,
    ).toBe('released')
    expect(
      result.finalLeases.find((lease) => lease.id === result.revoked.id)?.state,
    ).toBe('revoked')
    expect(result.revoked.state).toBe('revoked')
  })
})
