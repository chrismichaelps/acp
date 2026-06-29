/** @Acp.Infra.JsonRpc.WorkerCommands.Test — worker JSON-RPC mappings */
import { Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { parseJsonRpcCommand } from './json-rpc.js'

const expectRight = <A, E>(value: Either.Either<A, E>): A => {
  if (Either.isLeft(value)) {
    throw new Error(`expected Right, got ${String(value.left)}`)
  }
  return value.right
}

describe('JSON-RPC worker command mapping', () => {
  it('maps host-scoped worker reads', () => {
    const list = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_worker_list',
        method: 'worker.list',
      }),
    )
    expect(list.request).toEqual({
      method: 'GET',
      path: '/v1/workers',
      label: 'worker.list',
    })

    const get = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_worker_get',
        method: 'worker.get',
        params: { worker_id: 'worker/needs encoding' },
      }),
    )
    expect(get.request).toEqual({
      method: 'GET',
      path: '/v1/workers/worker%2Fneeds%20encoding',
      label: 'worker.get',
    })
  })
})
