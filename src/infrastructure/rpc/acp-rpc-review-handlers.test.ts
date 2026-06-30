/** @Acp.Infra.Rpc.ReviewHandlers.Test — native review RPC handlers */
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import type { WorkerId } from '../../protocol/schema/index.js'
import { AcpRpcGroup, AcpRpcs } from './acp-rpc-contract.js'
import {
  Runtime,
  bearer,
  decodeInitialize,
  decodePayload,
  rpcOptions,
} from './acp-rpc-test-support.js'

describe('AcpRpcReviewHandlersLive', () => {
  it('runs review handlers directly', async () => {
    const program = Effect.gen(function* () {
      const initialize = yield* AcpRpcGroup.accessHandler('session.initialize')
      const workspaceCreate =
        yield* AcpRpcGroup.accessHandler('workspace.create')
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

      const initPayload = yield* decodeInitialize([
        'workspace:read',
        'workspace:write',
        'work:create',
        'work:claim',
        'work:update',
        'review:create',
        'review:approve',
        'review:reject',
        'review:request_changes',
        'review:cancel',
      ])
      const session = yield* initialize(initPayload, rpcOptions())
      const headers = rpcOptions(bearer(session.session_id))
      const workspace = yield* workspaceCreate(
        yield* decodePayload(AcpRpcs.workspaceCreate.payloadSchema, {
          name: 'RPC Review Workspace',
          kind: 'git_repository',
          uri: 'git+https://example.com/acp/review-rpc.git',
        }),
        headers,
      )

      const makeRunningWork = (title: string) =>
        Effect.gen(function* () {
          const work = yield* workCreate(
            yield* decodePayload(AcpRpcs.workCreate.payloadSchema, {
              workspace_id: workspace.id,
              title,
            }),
            headers,
          )
          yield* workClaim(
            { work_id: work.id, worker_id: 'agent_rpc' as WorkerId },
            headers,
          )
          return yield* workUpdate(
            { work_id: work.id, state: 'running' },
            headers,
          )
        })

      const approvedWork = yield* makeRunningWork('Approve review')
      const cancelledWork = yield* makeRunningWork('Cancel review')
      const changesWork = yield* makeRunningWork('Request changes review')
      const rejectedWork = yield* makeRunningWork('Reject review')

      const approvedReview = yield* reviewRequest(
        yield* decodePayload(AcpRpcs.reviewRequest.payloadSchema, {
          work_id: approvedWork.id,
          requested_by: 'agent_rpc',
          reviewer: 'human_reviewer',
          requirements: ['diff_review', 'tests_pass'],
        }),
        headers,
      )
      const approved = yield* reviewApprove(
        yield* decodePayload(AcpRpcs.reviewApprove.payloadSchema, {
          review_id: approvedReview.id,
          met_requirements: ['diff_review', 'tests_pass'],
        }),
        headers,
      )
      const secondApprove = yield* Effect.either(
        reviewApprove(
          yield* decodePayload(AcpRpcs.reviewApprove.payloadSchema, {
            review_id: approvedReview.id,
            met_requirements: ['diff_review', 'tests_pass'],
          }),
          headers,
        ),
      )

      const cancelledReview = yield* reviewRequest(
        yield* decodePayload(AcpRpcs.reviewRequest.payloadSchema, {
          work_id: cancelledWork.id,
          requested_by: 'agent_rpc',
          requirements: [],
        }),
        headers,
      )
      const cancelled = yield* reviewCancel(
        { review_id: cancelledReview.id },
        headers,
      )
      const changesReview = yield* reviewRequest(
        yield* decodePayload(AcpRpcs.reviewRequest.payloadSchema, {
          work_id: changesWork.id,
          requested_by: 'agent_rpc',
          requirements: [],
        }),
        headers,
      )
      const changes = yield* reviewRequestChanges(
        { review_id: changesReview.id },
        headers,
      )
      const rejectedReview = yield* reviewRequest(
        yield* decodePayload(AcpRpcs.reviewRequest.payloadSchema, {
          work_id: rejectedWork.id,
          requested_by: 'agent_rpc',
          requirements: [],
        }),
        headers,
      )
      const rejected = yield* reviewReject(
        { review_id: rejectedReview.id },
        headers,
      )
      const forWork = yield* reviewListForWork(
        { work_id: approvedWork.id },
        headers,
      )
      const forWorkspace = yield* reviewListForWorkspace(
        { workspace_id: workspace.id },
        headers,
      )

      return {
        approved,
        cancelled,
        changes,
        forWork,
        forWorkspace,
        rejected,
        secondApprove,
      }
    })

    const result = await Effect.runPromise(Effect.provide(program, Runtime))
    expect(result.approved.state).toBe('approved')
    expect(result.cancelled.state).toBe('cancelled')
    expect(result.changes.state).toBe('changes_requested')
    expect(result.rejected.state).toBe('rejected')
    expect(result.forWork.map((review) => review.id)).toEqual([
      result.approved.id,
    ])
    expect(result.forWorkspace.map((review) => review.id).sort()).toEqual(
      [
        result.approved.id,
        result.cancelled.id,
        result.changes.id,
        result.rejected.id,
      ].sort(),
    )
    expect(Either.isLeft(result.secondApprove)).toBe(true)
    if (Either.isLeft(result.secondApprove)) {
      expect(result.secondApprove.left.error.code).toBe(
        'invalid_state_transition',
      )
    }
  })
})
