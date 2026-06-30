/** @Acp.Infra.Rpc.CheckpointHandlers.Test — native checkpoint RPC handlers */
import { Duration, Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { AcpRpcGroup, AcpRpcs } from './acp-rpc-contract.js'
import {
  Runtime,
  bearer,
  decodeInitialize,
  decodePayload,
  rpcOptions,
} from './acp-rpc-test-support.js'

describe('AcpRpcCheckpointHandlersLive', () => {
  it('runs checkpoint handlers directly', async () => {
    const program = Effect.gen(function* () {
      const initialize = yield* AcpRpcGroup.accessHandler('session.initialize')
      const workspaceCreate =
        yield* AcpRpcGroup.accessHandler('workspace.create')
      const workCreate = yield* AcpRpcGroup.accessHandler('work.create')
      const checkpointCreate =
        yield* AcpRpcGroup.accessHandler('checkpoint.create')
      const checkpointListForWork = yield* AcpRpcGroup.accessHandler(
        'checkpoint.list_for_work',
      )
      const checkpointLatestForWork = yield* AcpRpcGroup.accessHandler(
        'checkpoint.latest_for_work',
      )
      const checkpointListForWorkspace = yield* AcpRpcGroup.accessHandler(
        'checkpoint.list_for_workspace',
      )

      const initPayload = yield* decodeInitialize([
        'workspace:read',
        'workspace:write',
        'work:create',
        'checkpoint:create',
      ])
      const session = yield* initialize(initPayload, rpcOptions())
      const headers = rpcOptions(bearer(session.session_id))
      const workspace = yield* workspaceCreate(
        yield* decodePayload(AcpRpcs.workspaceCreate.payloadSchema, {
          name: 'RPC Checkpoint Workspace',
          kind: 'git_repository',
          uri: 'git+https://example.com/acp/checkpoint-rpc.git',
        }),
        headers,
      )
      const work = yield* workCreate(
        yield* decodePayload(AcpRpcs.workCreate.payloadSchema, {
          workspace_id: workspace.id,
          title: 'Record resumable progress',
        }),
        headers,
      )
      const emptyWork = yield* workCreate(
        yield* decodePayload(AcpRpcs.workCreate.payloadSchema, {
          workspace_id: workspace.id,
          title: 'No checkpoint yet',
        }),
        headers,
      )
      const first = yield* checkpointCreate(
        yield* decodePayload(AcpRpcs.checkpointCreate.payloadSchema, {
          workspace_id: workspace.id,
          work_id: work.id,
          summary: 'First checkpoint',
          completed_steps: ['planned handler'],
          remaining_steps: ['wire test'],
          modified_resources: ['file://src/infrastructure/rpc'],
        }),
        headers,
      )
      yield* Effect.sleep(Duration.millis(2))
      const second = yield* checkpointCreate(
        yield* decodePayload(AcpRpcs.checkpointCreate.payloadSchema, {
          workspace_id: workspace.id,
          work_id: work.id,
          summary: 'Second checkpoint',
          completed_steps: ['planned handler', 'wired test'],
          remaining_steps: [],
          modified_resources: ['file://src/infrastructure/rpc'],
        }),
        headers,
      )
      const forWork = yield* checkpointListForWork(
        { work_id: work.id },
        headers,
      )
      const latest = yield* checkpointLatestForWork(
        { work_id: work.id },
        headers,
      )
      const forWorkspace = yield* checkpointListForWorkspace(
        { workspace_id: workspace.id },
        headers,
      )
      const missingLatest = yield* Effect.either(
        checkpointLatestForWork({ work_id: emptyWork.id }, headers),
      )

      return { first, forWork, forWorkspace, latest, missingLatest, second }
    })

    const result = await Effect.runPromise(Effect.provide(program, Runtime))
    expect(result.forWork.map((checkpoint) => checkpoint.id)).toEqual([
      result.second.id,
      result.first.id,
    ])
    expect(result.latest.id).toBe(result.second.id)
    expect(result.forWorkspace.map((checkpoint) => checkpoint.id)).toEqual([
      result.second.id,
      result.first.id,
    ])
    expect(Either.isLeft(result.missingLatest)).toBe(true)
    if (Either.isLeft(result.missingLatest)) {
      expect(result.missingLatest.left.error.code).toBe('not_found')
    }
  })
})
