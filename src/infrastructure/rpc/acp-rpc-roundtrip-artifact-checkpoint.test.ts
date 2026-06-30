/** @Acp.Infra.Rpc.RoundtripArtifactCheckpoint.Test — generated client over artifact/checkpoint methods */
import { RpcTest } from '@effect/rpc'
import { Effect, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { AcpRpcGroup, AcpRpcs } from './acp-rpc-contract.js'
import { AcpRpcHandlersLive } from './acp-rpc-server.js'
import { decodeInitialize, decodePayload } from './acp-rpc-test-support.js'

describe('native RPC round-trip — artifact/checkpoint', () => {
  it('drives artifact and checkpoint methods through the generated client', async () => {
    const program = Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(AcpRpcGroup)

      const session = yield* client.session.initialize(
        yield* decodeInitialize([
          'workspace:read',
          'workspace:write',
          'work:create',
          'artifact:create',
          'artifact:update',
          'artifact:delete',
          'checkpoint:create',
        ]),
      )
      const auth = { authorization: `Bearer ${session.session_id}` }

      const workspace = yield* client.workspace.create(
        yield* decodePayload(AcpRpcs.workspaceCreate.payloadSchema, {
          name: 'RPC Artifact/Checkpoint Round-trip Workspace',
          kind: 'git_repository',
          uri: 'git+https://example.com/acp/artifact-checkpoint-roundtrip.git',
        }),
        { headers: auth },
      )
      const work = yield* client.work.create(
        yield* decodePayload(AcpRpcs.workCreate.payloadSchema, {
          workspace_id: workspace.id,
          title: 'Round-trip artifact/checkpoint work item',
        }),
        { headers: auth },
      )

      const created = yield* client.artifact.create(
        yield* decodePayload(AcpRpcs.artifactCreate.payloadSchema, {
          workspace_id: workspace.id,
          work_id: work.id,
          kind: 'patch',
          summary: 'Round-trip patch',
          content: 'diff --git a/roundtrip.ts b/roundtrip.ts',
        }),
        { headers: auth },
      )
      const updated = yield* client.artifact.update(
        yield* decodePayload(AcpRpcs.artifactUpdate.payloadSchema, {
          artifact_id: created.id,
          kind: 'patch',
          summary: 'Round-trip patch (revised)',
          content: 'diff --git a/roundtrip.ts b/roundtrip-revised.ts',
        }),
        { headers: auth },
      )
      const content = yield* client.artifact.content(
        { artifact_id: created.id },
        { headers: auth },
      )
      const forWork = yield* client.artifact.list_for_work(
        { work_id: work.id },
        { headers: auth },
      )
      const forWorkspace = yield* client.artifact.list_for_workspace(
        { workspace_id: workspace.id },
        { headers: auth },
      )
      const deleted = yield* client.artifact.delete(
        { artifact_id: created.id },
        { headers: auth },
      )

      const checkpoint = yield* client.checkpoint.create(
        yield* decodePayload(AcpRpcs.checkpointCreate.payloadSchema, {
          workspace_id: workspace.id,
          work_id: work.id,
          summary: 'Round-trip checkpoint',
          completed_steps: ['drove artifact methods through client'],
          remaining_steps: ['drive checkpoint reads'],
          modified_resources: ['file://src/infrastructure/rpc'],
        }),
        { headers: auth },
      )
      const checkpointsForWork = yield* client.checkpoint.list_for_work(
        { work_id: work.id },
        { headers: auth },
      )
      const latest = yield* client.checkpoint.latest_for_work(
        { work_id: work.id },
        { headers: auth },
      )
      const checkpointsForWorkspace =
        yield* client.checkpoint.list_for_workspace(
          { workspace_id: workspace.id },
          { headers: auth },
        )

      return {
        checkpoint,
        checkpointsForWork,
        checkpointsForWorkspace,
        content,
        created,
        deleted,
        forWork,
        forWorkspace,
        latest,
        updated,
        work,
      }
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(AcpRpcHandlersLive), Effect.scoped),
    )

    expect(result.updated.id).toBe(result.created.id)
    expect(result.updated.summary).toEqual(
      Option.some('Round-trip patch (revised)'),
    )
    expect(result.content.content).toContain('roundtrip-revised.ts')
    expect(result.forWork.map((a) => a.id)).toContain(result.created.id)
    expect(result.forWorkspace.map((a) => a.id)).toContain(result.created.id)
    expect(result.deleted.id).toBe(result.created.id)
    expect(result.checkpointsForWork.map((c) => c.id)).toEqual([
      result.checkpoint.id,
    ])
    expect(result.latest.id).toBe(result.checkpoint.id)
    expect(result.checkpointsForWorkspace.map((c) => c.id)).toEqual([
      result.checkpoint.id,
    ])
  })
})
