/** @Acp.Infra.JsonRpc.EventCommands.Test — event JSON-RPC command mapping */
import { Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { parseJsonRpcCommand } from './json-rpc.js'

const expectRight = <A, E>(value: Either.Either<A, E>): A => {
  if (Either.isLeft(value)) {
    throw new Error(`expected Right, got ${String(value.left)}`)
  }
  return value.right
}

describe('JSON-RPC event command mapping', () => {
  it('maps events.list with a replay limit', () => {
    const command = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_events_limited',
        method: 'events.list',
        params: { workspace_id: 'workspace/main', after_seq: '3', limit: '2' },
      }),
    )

    expect(command.request).toEqual({
      method: 'GET',
      path: '/v1/events?workspace_id=workspace%2Fmain&after_seq=3&limit=2',
      label: 'events.list',
    })
  })
})
