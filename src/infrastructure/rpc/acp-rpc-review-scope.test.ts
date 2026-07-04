/** @Acp.Infra.Rpc.ReviewScope.Test — review RPC tenancy */
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

describe('native RPC review workspace scope', () => {
  it('rejects review calls outside derived workspace binding', async () => {
    const program = Effect.gen(function* () {
      const initialize = yield* AcpRpcGroup.accessHandler('session.initialize')
      const workCreate = yield* AcpRpcGroup.accessHandler('work.create')
      const workClaim = yield* AcpRpcGroup.accessHandler('work.claim')
      const workUpdate = yield* AcpRpcGroup.accessHandler('work.update_state')
      const reviewRequest = yield* AcpRpcGroup.accessHandler('review.request')
      const reviewApprove = yield* AcpRpcGroup.accessHandler('review.approve')
      const reviewReject = yield* AcpRpcGroup.accessHandler('review.reject')
      const reviewRequestChanges = yield* AcpRpcGroup.accessHandler(
        'review.request_changes',
      )
      const reviewCancel = yield* AcpRpcGroup.accessHandler('review.cancel')
      const reviewListForWork = yield* AcpRpcGroup.accessHandler(
        'review.list_for_work',
      )
      const reviewListForWorkspace = yield* AcpRpcGroup.accessHandler(
        'review.list_for_workspace',
      )
      const workspaceId = 'workspace_rpc_review' as WorkspaceId
      const ownerPayload = yield* decodeInitialize(
        ['work:create', 'work:claim', 'work:update', 'review:create'],
        [workspaceId],
      )
      const attackerPayload = yield* decodeInitialize(
        [
          'workspace:read',
          'review:create',
          'review:approve',
          'review:reject',
          'review:request_changes',
          'review:cancel',
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
          title: 'Protected review work',
        }),
        ownerHeaders,
      )
      yield* workClaim(
        { work_id: work.id, worker_id: 'agent_rpc' as WorkerId },
        ownerHeaders,
      )
      yield* workUpdate({ work_id: work.id, state: 'running' }, ownerHeaders)
      const review = yield* reviewRequest(
        yield* decodePayload(AcpRpcs.reviewRequest.payloadSchema, {
          work_id: work.id,
          requested_by: 'agent_rpc',
          requirements: [],
        }),
        ownerHeaders,
      )

      const requested = yield* Effect.either(
        reviewRequest(
          yield* decodePayload(AcpRpcs.reviewRequest.payloadSchema, {
            work_id: work.id,
            requested_by: 'agent_rpc',
            requirements: [],
          }),
          attackerHeaders,
        ),
      )
      const approved = yield* Effect.either(
        reviewApprove(
          yield* decodePayload(AcpRpcs.reviewApprove.payloadSchema, {
            review_id: review.id,
            met_requirements: [],
          }),
          attackerHeaders,
        ),
      )
      const rejected = yield* Effect.either(
        reviewReject({ review_id: review.id }, attackerHeaders),
      )
      const changes = yield* Effect.either(
        reviewRequestChanges({ review_id: review.id }, attackerHeaders),
      )
      const cancelled = yield* Effect.either(
        reviewCancel({ review_id: review.id }, attackerHeaders),
      )
      const forWork = yield* Effect.either(
        reviewListForWork({ work_id: work.id }, attackerHeaders),
      )
      const forWorkspace = yield* Effect.either(
        reviewListForWorkspace({ workspace_id: workspaceId }, attackerHeaders),
      )

      return [
        code(requested),
        code(approved),
        code(rejected),
        code(changes),
        code(cancelled),
        code(forWork),
        code(forWorkspace),
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
