/** @Acp.Infra.Rpc.DerivedEvidenceScope.Test — resource-derived RPC tenancy */
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

describe('native RPC derived evidence workspace scope', () => {
  it('rejects artifact and checkpoint calls outside derived workspace binding', async () => {
    const program = Effect.gen(function* () {
      const initialize = yield* AcpRpcGroup.accessHandler('session.initialize')
      const workCreate = yield* AcpRpcGroup.accessHandler('work.create')
      const artifactCreate = yield* AcpRpcGroup.accessHandler('artifact.create')
      const artifactUpdate = yield* AcpRpcGroup.accessHandler('artifact.update')
      const artifactDelete = yield* AcpRpcGroup.accessHandler('artifact.delete')
      const artifactContent =
        yield* AcpRpcGroup.accessHandler('artifact.content')
      const artifactListForWork = yield* AcpRpcGroup.accessHandler(
        'artifact.list_for_work',
      )
      const checkpointCreate =
        yield* AcpRpcGroup.accessHandler('checkpoint.create')
      const checkpointListForWork = yield* AcpRpcGroup.accessHandler(
        'checkpoint.list_for_work',
      )
      const checkpointLatestForWork = yield* AcpRpcGroup.accessHandler(
        'checkpoint.latest_for_work',
      )
      const workspaceId = 'workspace_rpc_derived' as WorkspaceId
      const ownerPayload = yield* decodeInitialize(
        ['work:create', 'artifact:create', 'checkpoint:create'],
        [workspaceId],
      )
      const attackerPayload = yield* decodeInitialize(
        ['workspace:read', 'artifact:update', 'artifact:delete'],
        ['workspace_other' as WorkspaceId],
      )
      const owner = yield* initialize(ownerPayload, rpcOptions())
      const attacker = yield* initialize(attackerPayload, rpcOptions())
      const ownerHeaders = rpcOptions(bearer(owner.session_id))
      const attackerHeaders = rpcOptions(bearer(attacker.session_id))

      const work = yield* workCreate(
        yield* decodePayload(AcpRpcs.workCreate.payloadSchema, {
          workspace_id: workspaceId,
          title: 'Protected evidence work',
        }),
        ownerHeaders,
      )
      const artifact = yield* artifactCreate(
        yield* decodePayload(AcpRpcs.artifactCreate.payloadSchema, {
          workspace_id: workspaceId,
          work_id: work.id,
          kind: 'markdown',
          summary: 'Protected evidence',
          content: 'Target workspace content.',
        }),
        ownerHeaders,
      )
      yield* checkpointCreate(
        yield* decodePayload(AcpRpcs.checkpointCreate.payloadSchema, {
          workspace_id: workspaceId,
          work_id: work.id,
          summary: 'Protected checkpoint',
          completed_steps: ['created'],
          remaining_steps: [],
          modified_resources: [],
        }),
        ownerHeaders,
      )

      const content = yield* Effect.either(
        artifactContent({ artifact_id: artifact.id }, attackerHeaders),
      )
      const artifacts = yield* Effect.either(
        artifactListForWork({ work_id: work.id }, attackerHeaders),
      )
      const updated = yield* Effect.either(
        artifactUpdate(
          yield* decodePayload(AcpRpcs.artifactUpdate.payloadSchema, {
            artifact_id: artifact.id,
            kind: 'markdown',
            summary: 'Cross-workspace update',
            content: 'Should be denied.',
          }),
          attackerHeaders,
        ),
      )
      const deleted = yield* Effect.either(
        artifactDelete({ artifact_id: artifact.id }, attackerHeaders),
      )
      const checkpoints = yield* Effect.either(
        checkpointListForWork({ work_id: work.id }, attackerHeaders),
      )
      const latest = yield* Effect.either(
        checkpointLatestForWork({ work_id: work.id }, attackerHeaders),
      )

      return [
        code(content),
        code(artifacts),
        code(updated),
        code(deleted),
        code(checkpoints),
        code(latest),
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
    ])
  })
})
