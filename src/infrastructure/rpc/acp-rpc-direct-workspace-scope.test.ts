/** @Acp.Infra.Rpc.DirectWorkspaceScope.Test — explicit workspace RPC tenancy */
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import type { WorkspaceId } from '../../protocol/schema/index.js'
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

describe('native RPC direct workspace scope', () => {
  it('rejects evidence, memory, and event calls outside the session binding', async () => {
    const program = Effect.gen(function* () {
      const initialize = yield* AcpRpcGroup.accessHandler('session.initialize')
      const artifactCreate = yield* AcpRpcGroup.accessHandler('artifact.create')
      const artifactListForWorkspace = yield* AcpRpcGroup.accessHandler(
        'artifact.list_for_workspace',
      )
      const checkpointCreate =
        yield* AcpRpcGroup.accessHandler('checkpoint.create')
      const checkpointListForWorkspace = yield* AcpRpcGroup.accessHandler(
        'checkpoint.list_for_workspace',
      )
      const memoryCreate = yield* AcpRpcGroup.accessHandler('memory.create')
      const memoryList = yield* AcpRpcGroup.accessHandler('memory.list')
      const eventsList = yield* AcpRpcGroup.accessHandler('events.list')
      const workspaceId = 'workspace_rpc_direct' as WorkspaceId
      const payload = yield* decodeInitialize(
        [
          'workspace:read',
          'artifact:create',
          'checkpoint:create',
          'memory:create',
          'memory:read',
          'event:read',
        ],
        ['workspace_other' as WorkspaceId],
      )
      const session = yield* initialize(payload, rpcOptions())
      const headers = rpcOptions(bearer(session.session_id))

      const artifact = yield* Effect.either(
        artifactCreate(
          yield* decodePayload(AcpRpcs.artifactCreate.payloadSchema, {
            workspace_id: workspaceId,
            work_id: 'work_rpc_direct',
            kind: 'markdown',
            content: 'Cross-workspace artifact',
          }),
          headers,
        ),
      )
      const artifacts = yield* Effect.either(
        artifactListForWorkspace({ workspace_id: workspaceId }, headers),
      )
      const checkpoint = yield* Effect.either(
        checkpointCreate(
          yield* decodePayload(AcpRpcs.checkpointCreate.payloadSchema, {
            workspace_id: workspaceId,
            work_id: 'work_rpc_direct',
            summary: 'Cross-workspace checkpoint',
            completed_steps: [],
            remaining_steps: ['deny'],
            modified_resources: [],
          }),
          headers,
        ),
      )
      const checkpoints = yield* Effect.either(
        checkpointListForWorkspace({ workspace_id: workspaceId }, headers),
      )
      const memory = yield* Effect.either(
        memoryCreate(
          yield* decodePayload(AcpRpcs.memoryCreate.payloadSchema, {
            workspace_id: workspaceId,
            kind: 'observation',
            key: 'rpc.direct.denied',
            summary: 'Cross-workspace memory',
            content: 'Should not persist.',
            labels: [],
          }),
          headers,
        ),
      )
      const memories = yield* Effect.either(
        memoryList(
          yield* decodePayload(AcpRpcs.memoryList.payloadSchema, {
            workspace_id: workspaceId,
            after_seq: 0,
          }),
          headers,
        ),
      )
      const events = yield* Effect.either(
        eventsList({ workspace_id: workspaceId, after_seq: 0 }, headers),
      )

      return [
        code(artifact),
        code(artifacts),
        code(checkpoint),
        code(checkpoints),
        code(memory),
        code(memories),
        code(events),
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
