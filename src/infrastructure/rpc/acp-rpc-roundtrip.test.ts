/** @Acp.Infra.Rpc.Roundtrip.Test — generated client drives handlers end-to-end */
import { RpcTest } from '@effect/rpc'
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { AcpRpcGroup, AcpRpcs } from './acp-rpc-contract.js'
import { AcpRpcHandlersLive } from './acp-rpc-server.js'
import { decodeInitialize, decodePayload } from './acp-rpc-test-support.js'

describe('native RPC round-trip', () => {
  it('drives handlers through the generated typed client', async () => {
    const program = Effect.gen(function* () {
      // The generated client encodes payloads, serializes the request, and
      // decodes the typed response — a real client round-trip, not a direct
      // accessHandler call. Tags are dotted, so methods are prefix-grouped.
      const client = yield* RpcTest.makeClient(AcpRpcGroup)

      const session = yield* client.session.initialize(
        yield* decodeInitialize(['workspace:read', 'workspace:write']),
      )
      const auth = { authorization: `Bearer ${session.session_id}` }

      const created = yield* client.workspace.create(
        yield* decodePayload(AcpRpcs.workspaceCreate.payloadSchema, {
          name: 'RPC Round-trip Workspace',
          kind: 'git_repository',
          uri: 'git+https://example.com/acp/roundtrip-rpc.git',
        }),
        { headers: auth },
      )
      const listed = yield* client.workspace.list(undefined, { headers: auth })

      // A session minted without workspace:write must be refused by the same
      // per-handler authorization the transport forwards headers into.
      const scoped = yield* client.session.initialize(
        yield* decodeInitialize(['workspace:read']),
      )
      const denied = yield* Effect.either(
        client.workspace.create(
          yield* decodePayload(AcpRpcs.workspaceCreate.payloadSchema, {
            name: 'Should be rejected',
            kind: 'git_repository',
            uri: 'git+https://example.com/acp/denied.git',
          }),
          { headers: { authorization: `Bearer ${scoped.session_id}` } },
        ),
      )

      return { created, denied, listed }
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(AcpRpcHandlersLive), Effect.scoped),
    )

    expect(result.created.name).toBe('RPC Round-trip Workspace')
    expect(result.listed.map((w) => w.id)).toContain(result.created.id)
    expect(Either.isLeft(result.denied)).toBe(true)
    if (Either.isLeft(result.denied)) {
      expect(result.denied.left.error.code).toBe('unauthorized')
    }
  })
})
