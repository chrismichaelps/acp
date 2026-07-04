/** @Acp.Infra.Rpc.WorkLeaseScope.Test — native RPC by-id workspace scope */
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import type { WorkerId, WorkspaceId } from '../../protocol/schema/index.js'
import { AcpRpcGroup, AcpRpcs } from './acp-rpc-contract.js'
import {
  Runtime,
  bearer,
  decodeInitialize,
  decodePayload,
  rpcOptions,
} from './acp-rpc-test-support.js'

const code = (result: unknown) => {
  const denied = result as Either.Either<
    unknown,
    { readonly error: { readonly code: string } }
  >
  return Either.isLeft(denied) ? denied.left.error.code : 'right'
}

describe('native RPC work and lease workspace scope', () => {
  it('rejects by-id calls outside the derived workspace binding', async () => {
    const program = Effect.gen(function* () {
      const initialize = yield* AcpRpcGroup.accessHandler('session.initialize')
      const workCreate = yield* AcpRpcGroup.accessHandler('work.create')
      const workGet = yield* AcpRpcGroup.accessHandler('work.get')
      const workClaim = yield* AcpRpcGroup.accessHandler('work.claim')
      const workUpdate = yield* AcpRpcGroup.accessHandler('work.update_state')
      const workPublish = yield* AcpRpcGroup.accessHandler('work.publish_event')
      const leaseRequest = yield* AcpRpcGroup.accessHandler('lease.request')
      const leaseRenew = yield* AcpRpcGroup.accessHandler('lease.renew')
      const leaseRelease = yield* AcpRpcGroup.accessHandler('lease.release')
      const leaseRevoke = yield* AcpRpcGroup.accessHandler('lease.revoke')
      const workspaceId = 'workspace_rpc_target' as WorkspaceId
      const ownerPayload = yield* decodeInitialize(
        ['work:create', 'lease:create'],
        [workspaceId],
      )
      const attackerPayload = yield* decodeInitialize(
        [
          'workspace:read',
          'work:claim',
          'work:update',
          'work:publish_event',
          'lease:renew',
          'lease:release',
          'lease:revoke',
        ],
        ['workspace_other' as WorkspaceId],
      )
      const owner = yield* initialize(ownerPayload, rpcOptions())
      const attacker = yield* initialize(attackerPayload, rpcOptions())
      const ownerHeaders = rpcOptions(bearer(owner.session_id))
      const attackerHeaders = rpcOptions(bearer(attacker.session_id))

      const work = yield* workCreate(
        yield* decodePayload(AcpRpcs.workCreate.payloadSchema, {
          workspace_id: workspaceId,
          title: 'Protected RPC work',
        }),
        ownerHeaders,
      )
      const lease = yield* leaseRequest(
        yield* decodePayload(AcpRpcs.leaseRequest.payloadSchema, {
          workspace_id: workspaceId,
          holder: 'agent_rpc',
          resource: { kind: 'file', uri: 'file://src/rpc/protected.ts' },
        }),
        ownerHeaders,
      )

      const fetched = yield* Effect.either(
        workGet({ work_id: work.id }, attackerHeaders),
      )
      const claimed = yield* Effect.either(
        workClaim(
          { work_id: work.id, worker_id: 'agent_rpc' as WorkerId },
          attackerHeaders,
        ),
      )
      const updated = yield* Effect.either(
        workUpdate({ work_id: work.id, state: 'running' }, attackerHeaders),
      )
      const published = yield* Effect.either(
        workPublish(
          yield* decodePayload(AcpRpcs.workPublishEvent.payloadSchema, {
            work_id: work.id,
            type: 'work.progressed',
            data: { message: 'cross-workspace publish' },
          }),
          attackerHeaders,
        ),
      )
      const renewed = yield* Effect.either(
        leaseRenew(
          yield* decodePayload(AcpRpcs.leaseRenew.payloadSchema, {
            lease_id: lease.id,
            ttl_seconds: 120,
          }),
          attackerHeaders,
        ),
      )
      const released = yield* Effect.either(
        leaseRelease({ lease_id: lease.id }, attackerHeaders),
      )
      const revoked = yield* Effect.either(
        leaseRevoke({ lease_id: lease.id }, attackerHeaders),
      )

      return [
        code(fetched),
        code(claimed),
        code(updated),
        code(published),
        code(renewed),
        code(released),
        code(revoked),
      ]
    })

    const result = await Effect.runPromise(Effect.provide(program, Runtime))
    expect(result).toEqual([
      'forbidden',
      'forbidden',
      'forbidden',
      'forbidden',
      'forbidden',
      'forbidden',
      'forbidden',
    ])
  })
})
