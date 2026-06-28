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
  })
})
