/** @Acp.Infra.Rpc.MemoryEventHandlers.Test — native memory and event RPC handlers */
import { Effect, Either, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { AcpRpcGroup, AcpRpcs } from './acp-rpc-contract.js'
import type { WorkerId } from '../../protocol/schema/index.js'
import {
  Runtime,
  bearer,
  decodeInitialize,
  decodePayload,
  rpcOptions,
} from './acp-rpc-test-support.js'
import { AcpRpcActor } from './rpc-auth.js'

describe('AcpRpcMemoryEventHandlersLive', () => {
  it('runs memory and event handlers directly', async () => {
    const program = Effect.gen(function* () {
      const initialize = yield* AcpRpcGroup.accessHandler('session.initialize')
      const workspaceCreate =
        yield* AcpRpcGroup.accessHandler('workspace.create')
      const workCreate = yield* AcpRpcGroup.accessHandler('work.create')
      const workPublishEvent =
        yield* AcpRpcGroup.accessHandler('work.publish_event')
      const memoryCreate = yield* AcpRpcGroup.accessHandler('memory.create')
      const memoryList = yield* AcpRpcGroup.accessHandler('memory.list')
      const eventsList = yield* AcpRpcGroup.accessHandler('events.list')

      const initPayload = yield* decodeInitialize([
        'workspace:write',
        'work:create',
        'work:publish_event',
        'memory:create',
        'memory:read',
        'event:read',
      ])
      const session = yield* initialize(initPayload, rpcOptions())
      const headers = rpcOptions(bearer(session.session_id))

      const workspace = yield* workspaceCreate(
        yield* decodePayload(AcpRpcs.workspaceCreate.payloadSchema, {
          name: 'RPC Memory Workspace',
          kind: 'git_repository',
          uri: 'git+https://example.com/acp/memory-rpc.git',
        }),
        headers,
      )
      const work = yield* workCreate(
        yield* decodePayload(AcpRpcs.workCreate.payloadSchema, {
          workspace_id: workspace.id,
          title: 'Record recall and replay',
        }),
        headers,
      )

      const event = yield* workPublishEvent(
        yield* decodePayload(AcpRpcs.workPublishEvent.payloadSchema, {
          work_id: work.id,
          type: 'work.progressed',
          data: { message: 'native rpc event replay covered' },
        }),
        headers,
      )
      const events = yield* eventsList(
        {
          workspace_id: workspace.id,
          after_seq: event.seq - 1,
          limit: Option.some(1),
        },
        headers,
      )

      const memory = yield* memoryCreate(
        yield* decodePayload(AcpRpcs.memoryCreate.payloadSchema, {
          workspace_id: workspace.id,
          work_id: work.id,
          kind: 'decision',
          key: 'rpc.memory.replay',
          summary: 'Native RPC memory record persisted.',
          content: 'memory.create dispatches straight to the memory service.',
          labels: ['rpc', 'memory'],
        }),
        headers,
      )
      const records = yield* memoryList(
        yield* decodePayload(AcpRpcs.memoryList.payloadSchema, {
          workspace_id: workspace.id,
          after_seq: 0,
        }),
        headers,
      )

      const scopedSession = yield* initialize(
        yield* decodeInitialize(['workspace:write']),
        rpcOptions(),
      )
      const unauthorized = yield* Effect.either(
        eventsList(
          { workspace_id: workspace.id, after_seq: 0, limit: Option.none() },
          rpcOptions(bearer(scopedSession.session_id)),
        ),
      )

      return { event, events, memory, records, unauthorized }
    })

    const result = await Effect.runPromise(Effect.provide(program, Runtime))

    expect(result.events.map((e) => e.id)).toContain(result.event.id)
    expect(result.records.map((m) => m.id)).toEqual([result.memory.id])
    expect(result.memory.seq).toBe(1)
    expect(Either.isLeft(result.unauthorized)).toBe(true)
  })

  it('accepts a middleware-provided actor for handler attribution', async () => {
    const program = Effect.gen(function* () {
      const memoryCreate = yield* AcpRpcGroup.accessHandler('memory.create')
      return yield* memoryCreate(
        yield* decodePayload(AcpRpcs.memoryCreate.payloadSchema, {
          workspace_id: 'workspace_actor_bridge',
          kind: 'observation',
          key: 'rpc.actor.bridge',
          summary: 'Actor provided by middleware context.',
          content: 'The handler reads AcpRpcActor before falling back to auth.',
          labels: ['rpc', 'actor'],
        }),
        rpcOptions(),
      )
    }).pipe(Effect.provideService(AcpRpcActor, 'agent_rpc' as WorkerId))

    const result = await Effect.runPromise(Effect.provide(program, Runtime))

    expect(result.created_by).toBe('agent_rpc')
  })
})
