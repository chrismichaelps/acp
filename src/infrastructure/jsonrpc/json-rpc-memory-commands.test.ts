/** @Acp.Infra.JsonRpc.MemoryCommands.Test — memory JSON-RPC command mapping */
import { Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { parseJsonRpcCommand } from './json-rpc.js'

const expectRight = <A, E>(value: Either.Either<A, E>): A => {
  if (Either.isLeft(value)) {
    throw new Error(`expected Right, got ${String(value.left)}`)
  }
  return value.right
}

describe('JSON-RPC memory command mapping', () => {
  it('maps memory.create to POST /v1/memory with the wire body', () => {
    const command = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_memory_create',
        method: 'memory.create',
        params: {
          workspace_id: 'workspace_1',
          kind: 'decision',
          key: 'auth-strategy',
          summary: 'Bearer sessions',
          content: 'Use bearer session ids minted at initialize.',
          labels: ['auth'],
        },
      }),
    )
    expect(command.request).toEqual({
      method: 'POST',
      path: '/v1/memory',
      body: {
        workspace_id: 'workspace_1',
        kind: 'decision',
        key: 'auth-strategy',
        summary: 'Bearer sessions',
        content: 'Use bearer session ids minted at initialize.',
        labels: ['auth'],
      },
      label: 'memory.create',
    })
  })

  it('maps memory.list to GET /v1/memory rendering only provided filters', () => {
    const command = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_memory_list',
        method: 'memory.list',
        params: {
          workspace_id: 'workspace_1',
          after_seq: 5,
          limit: 10,
          kind: 'handoff',
        },
      }),
    )
    expect(command.request).toEqual({
      method: 'GET',
      path: '/v1/memory?workspace_id=workspace_1&after_seq=5&limit=10&kind=handoff',
      label: 'memory.list',
    })
  })

  it('defaults memory.list after_seq when omitted and requires workspace_id', () => {
    const command = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_memory_list_min',
        method: 'memory.list',
        params: { workspace_id: 'workspace_1' },
      }),
    )
    expect(command.request.path).toBe('/v1/memory?workspace_id=workspace_1')

    const missing = parseJsonRpcCommand({
      jsonrpc: '2.0',
      id: 'rpc_memory_list_bad',
      method: 'memory.list',
      params: {},
    })
    expect(Either.isLeft(missing)).toBe(true)
  })
})
