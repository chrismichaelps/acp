/** @Acp.Infra.JsonRpc.ResumeCommands.Test — resume method mapping */
import { Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { parseJsonRpcCommand } from './json-rpc.js'

const expectRight = <A, E>(value: Either.Either<A, E>): A => {
  if (Either.isLeft(value)) {
    throw new Error(`expected Right, got ${String(value.left)}`)
  }
  return value.right
}

describe('JSON-RPC resume command mapping', () => {
  it('maps work resume read methods and encodes the work id path segment', () => {
    const getWork = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_work_get',
        method: 'work.get',
        params: { work_id: 'work/needs encoding' },
      }),
    )
    expect(getWork.request).toEqual({
      method: 'GET',
      path: '/v1/work/work%2Fneeds%20encoding',
      label: 'work.get',
    })

    const workIndex = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_work_index',
        method: 'work.list_for_workspace',
        params: { workspace_id: 'workspace/needs encoding' },
      }),
    )
    expect(workIndex.request).toEqual({
      method: 'GET',
      path: '/v1/workspaces/workspace%2Fneeds%20encoding/work',
      label: 'work.list_for_workspace',
    })

    const checkpoints = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_checkpoint_list',
        method: 'checkpoint.list_for_work',
        params: { work_id: 'work/needs encoding' },
      }),
    )
    expect(checkpoints.request).toEqual({
      method: 'GET',
      path: '/v1/work/work%2Fneeds%20encoding/checkpoints',
      label: 'checkpoint.list_for_work',
    })

    const workspaceCheckpoints = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_checkpoint_workspace',
        method: 'checkpoint.list_for_workspace',
        params: { workspace_id: 'workspace/needs encoding' },
      }),
    )
    expect(workspaceCheckpoints.request).toEqual({
      method: 'GET',
      path: '/v1/workspaces/workspace%2Fneeds%20encoding/checkpoints',
      label: 'checkpoint.list_for_workspace',
    })

    const latest = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_checkpoint_latest',
        method: 'checkpoint.latest_for_work',
        params: { work_id: 'work/needs encoding' },
      }),
    )
    expect(latest.request).toEqual({
      method: 'GET',
      path: '/v1/work/work%2Fneeds%20encoding/checkpoints/latest',
      label: 'checkpoint.latest_for_work',
    })

    const artifacts = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_artifact_list',
        method: 'artifact.list_for_work',
        params: { work_id: 'work/needs encoding' },
      }),
    )
    expect(artifacts.request).toEqual({
      method: 'GET',
      path: '/v1/work/work%2Fneeds%20encoding/artifacts',
      label: 'artifact.list_for_work',
    })

    const workspaceArtifacts = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_artifact_workspace',
        method: 'artifact.list_for_workspace',
        params: { workspace_id: 'workspace/needs encoding' },
      }),
    )
    expect(workspaceArtifacts.request).toEqual({
      method: 'GET',
      path: '/v1/workspaces/workspace%2Fneeds%20encoding/artifacts',
      label: 'artifact.list_for_workspace',
    })

    const reviews = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_review_list',
        method: 'review.list_for_work',
        params: { work_id: 'work/needs encoding' },
      }),
    )
    expect(reviews.request).toEqual({
      method: 'GET',
      path: '/v1/work/work%2Fneeds%20encoding/reviews',
      label: 'review.list_for_work',
    })

    const workspaceReviews = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_review_workspace',
        method: 'review.list_for_workspace',
        params: { workspace_id: 'workspace/needs encoding' },
      }),
    )
    expect(workspaceReviews.request).toEqual({
      method: 'GET',
      path: '/v1/workspaces/workspace%2Fneeds%20encoding/reviews',
      label: 'review.list_for_workspace',
    })
  })

  it('maps artifact content reads and encodes the artifact id path segment', () => {
    const content = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_artifact_content',
        method: 'artifact.read_content',
        params: { artifact_id: 'artifact/needs encoding' },
      }),
    )
    expect(content.request).toEqual({
      method: 'GET',
      path: '/v1/artifacts/artifact%2Fneeds%20encoding/content',
      label: 'artifact.read_content',
    })
  })
})
