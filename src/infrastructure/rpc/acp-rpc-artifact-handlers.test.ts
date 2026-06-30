/** @Acp.Infra.Rpc.ArtifactHandlers.Test — native artifact RPC handlers */
import { Effect, Either, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { AcpRpcGroup, AcpRpcs } from './acp-rpc-contract.js'
import {
  Runtime,
  bearer,
  decodeInitialize,
  decodePayload,
  rpcOptions,
} from './acp-rpc-test-support.js'
import { AcpRpcActor } from './rpc-auth.js'
import type { WorkerId } from '../../protocol/schema/index.js'

describe('AcpRpcArtifactHandlersLive', () => {
  it('runs artifact handlers directly', async () => {
    const program = Effect.gen(function* () {
      const initialize = yield* AcpRpcGroup.accessHandler('session.initialize')
      const workspaceCreate =
        yield* AcpRpcGroup.accessHandler('workspace.create')
      const workCreate = yield* AcpRpcGroup.accessHandler('work.create')
      const artifactCreate = yield* AcpRpcGroup.accessHandler('artifact.create')
      const artifactUpdate = yield* AcpRpcGroup.accessHandler('artifact.update')
      const artifactContent =
        yield* AcpRpcGroup.accessHandler('artifact.content')
      const artifactListForWork = yield* AcpRpcGroup.accessHandler(
        'artifact.list_for_work',
      )
      const artifactListForWorkspace = yield* AcpRpcGroup.accessHandler(
        'artifact.list_for_workspace',
      )
      const artifactDelete = yield* AcpRpcGroup.accessHandler('artifact.delete')

      const initPayload = yield* decodeInitialize([
        'workspace:read',
        'workspace:write',
        'work:create',
        'artifact:create',
        'artifact:update',
        'artifact:delete',
      ])
      const session = yield* initialize(initPayload, rpcOptions())
      const headers = rpcOptions(bearer(session.session_id))
      const workspace = yield* workspaceCreate(
        yield* decodePayload(AcpRpcs.workspaceCreate.payloadSchema, {
          name: 'RPC Artifact Workspace',
          kind: 'git_repository',
          uri: 'git+https://example.com/acp/artifact-rpc.git',
        }),
        headers,
      )
      const work = yield* workCreate(
        yield* decodePayload(AcpRpcs.workCreate.payloadSchema, {
          workspace_id: workspace.id,
          title: 'Produce artifact evidence',
        }),
        headers,
      )
      const artifact = yield* artifactCreate(
        yield* decodePayload(AcpRpcs.artifactCreate.payloadSchema, {
          workspace_id: workspace.id,
          work_id: work.id,
          kind: 'patch',
          media_type: 'text/x-diff',
          summary: 'Initial patch',
          content: 'diff --git a/src/a.ts b/src/a.ts',
        }),
        headers,
      )
      const initialContent = yield* artifactContent(
        { artifact_id: artifact.id },
        headers,
      )
      const updated = yield* artifactUpdate(
        yield* decodePayload(AcpRpcs.artifactUpdate.payloadSchema, {
          artifact_id: artifact.id,
          kind: 'patch',
          media_type: 'text/x-diff',
          summary: 'Updated patch',
          content: 'diff --git a/src/b.ts b/src/b.ts',
        }),
        headers,
      )
      const updatedContent = yield* artifactContent(
        { artifact_id: artifact.id },
        headers,
      )
      const externalArtifact = yield* artifactCreate(
        yield* decodePayload(AcpRpcs.artifactCreate.payloadSchema, {
          workspace_id: workspace.id,
          work_id: work.id,
          kind: 'pull_request',
          uri: 'https://example.com/acp/artifacts/pr-77',
          summary: 'External pull request',
        }),
        headers,
      )
      const externalContent = yield* Effect.either(
        artifactContent({ artifact_id: externalArtifact.id }, headers),
      )
      const forWork = yield* artifactListForWork({ work_id: work.id }, headers)
      const forWorkspace = yield* artifactListForWorkspace(
        { workspace_id: workspace.id },
        headers,
      )
      const deleted = yield* artifactDelete(
        { artifact_id: artifact.id },
        headers,
      )
      const afterDelete = yield* Effect.either(
        artifactContent({ artifact_id: artifact.id }, headers),
      )

      return {
        afterDelete,
        artifact,
        deleted,
        externalArtifact,
        externalContent,
        forWork,
        forWorkspace,
        initialContent,
        updated,
        updatedContent,
      }
    })

    const result = await Effect.runPromise(Effect.provide(program, Runtime))
    expect(result.artifact.uri).toBe(`acp://artifacts/${result.artifact.id}`)
    expect(result.initialContent.content).toContain('src/a.ts')
    expect(result.updated.id).toBe(result.artifact.id)
    expect(result.updated.summary).toEqual(Option.some('Updated patch'))
    expect(result.updatedContent.content).toContain('src/b.ts')
    expect(result.externalArtifact.uri).toBe(
      'https://example.com/acp/artifacts/pr-77',
    )
    expect(result.forWork.map((artifact) => artifact.id)).toContain(
      result.artifact.id,
    )
    expect(result.forWork.map((artifact) => artifact.id)).toContain(
      result.externalArtifact.id,
    )
    expect(result.forWorkspace.map((artifact) => artifact.id)).toContain(
      result.artifact.id,
    )
    expect(result.deleted.id).toBe(result.artifact.id)
    expect(Either.isLeft(result.externalContent)).toBe(true)
    if (Either.isLeft(result.externalContent)) {
      expect(result.externalContent.left.error.code).toBe('not_found')
    }
    expect(Either.isLeft(result.afterDelete)).toBe(true)
    if (Either.isLeft(result.afterDelete)) {
      expect(result.afterDelete.left.error.code).toBe('not_found')
    }
  })

  it('accepts a middleware-provided actor for mutation attribution', async () => {
    const program = Effect.gen(function* () {
      const artifactCreate = yield* AcpRpcGroup.accessHandler('artifact.create')
      return yield* artifactCreate(
        yield* decodePayload(AcpRpcs.artifactCreate.payloadSchema, {
          workspace_id: 'workspace_artifact_actor',
          work_id: 'work_artifact_actor',
          kind: 'log',
          media_type: 'text/plain',
          summary: 'Artifact actor bridge',
          content: 'created with AcpRpcActor context',
        }),
        rpcOptions(),
      )
    }).pipe(Effect.provideService(AcpRpcActor, 'agent_rpc' as WorkerId))

    const result = await Effect.runPromise(Effect.provide(program, Runtime))

    expect(result.created_by).toBe('agent_rpc')
  })
})
