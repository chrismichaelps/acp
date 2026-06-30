/** @Acp.Infra.Rpc.Client.Test — native RPC client ergonomics */
import { RpcTest } from '@effect/rpc'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  acpNativeRpcPath,
  acpNativeRpcUrl,
  acpRpcBearerHeaders,
  acpRpcClientHostLayer,
  withAcpRpcBearer,
} from './acp-rpc-client.js'
import { AcpRpcGroup, AcpRpcs } from './acp-rpc-contract.js'
import { AcpRpcHandlersLive } from './acp-rpc-server.js'
import { decodeInitialize, decodePayload } from './acp-rpc-test-support.js'

describe('native RPC client helpers', () => {
  it('derives the mounted native RPC URL from a host base URL', () => {
    expect(acpNativeRpcPath).toBe('/rpc/native')
    expect(acpNativeRpcUrl('http://localhost:4317')).toBe(
      'http://localhost:4317/rpc/native',
    )
    expect(acpNativeRpcUrl('http://localhost:4317/')).toBe(
      'http://localhost:4317/rpc/native',
    )
    expect(acpRpcClientHostLayer('http://localhost:4317')).toBeDefined()
  })

  it('scopes generated client calls with a bearer session header', async () => {
    const program = Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(AcpRpcGroup)
      const session = yield* client.session.initialize(
        yield* decodeInitialize(['workspace:write']),
      )
      const workspace = yield* withAcpRpcBearer(session.session_id)(
        client.workspace.create(
          yield* decodePayload(AcpRpcs.workspaceCreate.payloadSchema, {
            name: 'Bearer Helper Workspace',
            kind: 'git_repository',
            uri: 'git+https://example.com/acp/bearer-helper.git',
          }),
        ),
      )

      return { session, workspace }
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(AcpRpcHandlersLive), Effect.scoped),
    )

    expect(acpRpcBearerHeaders(result.session.session_id)).toEqual({
      authorization: `Bearer ${result.session.session_id}`,
    })
    expect(result.workspace.name).toBe('Bearer Helper Workspace')
  })
})
