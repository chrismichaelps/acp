/** @Acp.Infra.Rpc.RoundtripReviewMemoryEvent.Test — generated client over review/memory/event methods */
import { RpcTest } from '@effect/rpc'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import type { WorkerId } from '../../protocol/schema/index.js'
import { AcpRpcGroup, AcpRpcs } from './acp-rpc-contract.js'
import { AcpRpcHandlersLive } from './acp-rpc-server.js'
import { decodeInitialize, decodePayload } from './acp-rpc-test-support.js'

describe('native RPC round-trip — review/memory/event', () => {
  it('drives review, memory, and event.list methods through the generated client', async () => {
    const program = Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(AcpRpcGroup)

      const session = yield* client.session.initialize(
        yield* decodeInitialize([
          'workspace:read',
          'workspace:write',
          'work:create',
          'work:claim',
          'work:update',
          'work:publish_event',
          'review:create',
          'review:approve',
          'review:reject',
          'review:request_changes',
          'review:cancel',
          'memory:create',
          'memory:read',
          'event:read',
        ]),
      )
      const auth = { authorization: `Bearer ${session.session_id}` }

      const workspace = yield* client.workspace.create(
        yield* decodePayload(AcpRpcs.workspaceCreate.payloadSchema, {
          name: 'RPC Review/Memory/Event Round-trip Workspace',
          kind: 'git_repository',
          uri: 'git+https://example.com/acp/review-memory-event-roundtrip.git',
        }),
        { headers: auth },
      )

      const makeRunningWork = (title: string) =>
        Effect.gen(function* () {
          const work = yield* client.work.create(
            yield* decodePayload(AcpRpcs.workCreate.payloadSchema, {
              workspace_id: workspace.id,
              title,
            }),
            { headers: auth },
          )
          yield* client.work.claim(
            { work_id: work.id, worker_id: 'agent_rpc' as WorkerId },
            { headers: auth },
          )
          return yield* client.work.update_state(
            { work_id: work.id, state: 'running' },
            { headers: auth },
          )
        })

      const approvedWork = yield* makeRunningWork('Round-trip approve review')
      const cancelledWork = yield* makeRunningWork('Round-trip cancel review')
      const changesWork = yield* makeRunningWork(
        'Round-trip request_changes review',
      )
      const rejectedWork = yield* makeRunningWork('Round-trip reject review')

      const approvedReview = yield* client.review.request(
        yield* decodePayload(AcpRpcs.reviewRequest.payloadSchema, {
          work_id: approvedWork.id,
          requested_by: 'agent_rpc',
          requirements: [],
        }),
        { headers: auth },
      )
      const approved = yield* client.review.approve(
        { review_id: approvedReview.id, met_requirements: [] },
        { headers: auth },
      )

      const cancelledReview = yield* client.review.request(
        yield* decodePayload(AcpRpcs.reviewRequest.payloadSchema, {
          work_id: cancelledWork.id,
          requested_by: 'agent_rpc',
          requirements: [],
        }),
        { headers: auth },
      )
      const cancelled = yield* client.review.cancel(
        { review_id: cancelledReview.id },
        { headers: auth },
      )

      const changesReview = yield* client.review.request(
        yield* decodePayload(AcpRpcs.reviewRequest.payloadSchema, {
          work_id: changesWork.id,
          requested_by: 'agent_rpc',
          requirements: [],
        }),
        { headers: auth },
      )
      const changes = yield* client.review.request_changes(
        { review_id: changesReview.id },
        { headers: auth },
      )

      const rejectedReview = yield* client.review.request(
        yield* decodePayload(AcpRpcs.reviewRequest.payloadSchema, {
          work_id: rejectedWork.id,
          requested_by: 'agent_rpc',
          requirements: [],
        }),
        { headers: auth },
      )
      const rejected = yield* client.review.reject(
        { review_id: rejectedReview.id },
        { headers: auth },
      )

      const forWork = yield* client.review.list_for_work(
        { work_id: approvedWork.id },
        { headers: auth },
      )
      const forWorkspace = yield* client.review.list_for_workspace(
        { workspace_id: workspace.id },
        { headers: auth },
      )

      const memory = yield* client.memory.create(
        yield* decodePayload(AcpRpcs.memoryCreate.payloadSchema, {
          workspace_id: workspace.id,
          work_id: approvedWork.id,
          kind: 'decision',
          key: 'rpc.roundtrip.memory',
          summary: 'Round-trip memory record persisted.',
          content: 'memory.create dispatched through the generated client.',
          labels: ['rpc', 'roundtrip'],
        }),
        { headers: auth },
      )
      const memories = yield* client.memory.list(
        yield* decodePayload(AcpRpcs.memoryList.payloadSchema, {
          workspace_id: workspace.id,
          after_seq: 0,
        }),
        { headers: auth },
      )

      const published = yield* client.work.publish_event(
        { work_id: approvedWork.id, type: 'work.progressed', data: {} },
        { headers: auth },
      )
      const events = yield* client.events.list(
        { workspace_id: workspace.id, after_seq: 0 },
        { headers: auth },
      )

      return {
        approved,
        cancelled,
        changes,
        events,
        forWork,
        forWorkspace,
        memories,
        memory,
        published,
        rejected,
      }
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(AcpRpcHandlersLive), Effect.scoped),
    )

    expect(result.approved.state).toBe('approved')
    expect(result.cancelled.state).toBe('cancelled')
    expect(result.changes.state).toBe('changes_requested')
    expect(result.rejected.state).toBe('rejected')
    expect(result.forWork.map((r) => r.id)).toEqual([result.approved.id])
    expect(result.forWorkspace.map((r) => r.id).sort()).toEqual(
      [
        result.approved.id,
        result.cancelled.id,
        result.changes.id,
        result.rejected.id,
      ].sort(),
    )
    expect(result.memories.map((m) => m.id)).toEqual([result.memory.id])
    expect(result.events.map((e) => e.id)).toContain(result.published.id)
  })
})
