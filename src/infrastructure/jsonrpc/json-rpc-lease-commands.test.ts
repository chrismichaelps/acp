/** @Acp.Infra.JsonRpc.LeaseCommands.Test — lease JSON-RPC command mapping */
import { Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { parseJsonRpcCommand } from './json-rpc.js'

const expectRight = <A, E>(value: Either.Either<A, E>): A => {
  if (Either.isLeft(value)) {
    throw new Error(`expected Right, got ${String(value.left)}`)
  }
  return value.right
}

describe('JSON-RPC lease command mapping', () => {
  it('maps lease renew and revoke commands', () => {
    const renew = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_lease_renew',
        method: 'lease.renew',
        params: { lease_id: 'lease/main', ttl_seconds: 120 },
      }),
    )
    expect(renew.request).toEqual({
      method: 'POST',
      path: '/v1/leases/lease%2Fmain/renew',
      body: { ttl_seconds: 120 },
      label: 'lease.renew',
    })

    const revoke = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_lease_revoke',
        method: 'lease.revoke',
        params: { lease_id: 'lease/main' },
      }),
    )
    expect(revoke.request).toEqual({
      method: 'POST',
      path: '/v1/leases/lease%2Fmain/revoke',
      label: 'lease.revoke',
    })
  })
})
