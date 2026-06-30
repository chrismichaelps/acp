/** @Acp.App.Server.NativeRpcRoute.Test — native Effect RPC over the live host socket */
import { HttpServer } from '@effect/platform'
import { Duration, Effect, Either, Fiber, Option, Stream } from 'effect'
import { describe, expect, it } from 'vitest'
import { nodeHttpServerLayer } from '../../infrastructure/platform-node/index.js'
import {
  AcpRpcs,
  acpRpcClientHttpLayer,
  makeAcpRpcClient,
} from '../../infrastructure/rpc/index.js'
import {
  decodeInitialize,
  decodePayload,
} from '../../infrastructure/rpc/acp-rpc-test-support.js'
import { HttpAppLive } from './http-app.js'
import { nativeRpcPath } from './native-rpc-route.js'

const EphemeralServerLive = nodeHttpServerLayer(0)

const onLiveServer = <A>(use: (baseUrl: string) => Promise<A>) =>
  Effect.runPromise(
    HttpServer.addressWith((address) => {
      const port = address._tag === 'TcpAddress' ? address.port : 0
      return Effect.promise(() => use(`http://127.0.0.1:${port.toString()}`))
    }).pipe(
      Effect.provide(HttpAppLive),
      Effect.provide(EphemeralServerLive),
      Effect.scoped,
    ),
  )

describe('native RPC route', () => {
  it('serves the typed client over HTTP and shares state with REST', async () => {
    const result = await onLiveServer(async (baseUrl) => {
      const created = await Effect.runPromise(
        Effect.gen(function* () {
          const client = yield* makeAcpRpcClient
          const session = yield* client.session.initialize(
            yield* decodeInitialize(['workspace:read', 'workspace:write']),
          )
          const headers = { authorization: `Bearer ${session.session_id}` }
          const workspace = yield* client.workspace.create(
            yield* decodePayload(AcpRpcs.workspaceCreate.payloadSchema, {
              name: 'Native RPC Mounted Workspace',
              kind: 'git_repository',
              uri: 'git+https://example.com/acp/native-rpc.git',
            }),
            { headers },
          )
          const readOnly = yield* client.session.initialize(
            yield* decodeInitialize(['workspace:read']),
          )
          const denied = yield* Effect.either(
            client.workspace.create(
              yield* decodePayload(AcpRpcs.workspaceCreate.payloadSchema, {
                name: 'Native RPC Denied Workspace',
                kind: 'git_repository',
                uri: 'git+https://example.com/acp/native-rpc-denied.git',
              }),
              {
                headers: {
                  authorization: `Bearer ${readOnly.session_id}`,
                },
              },
            ),
          )
          return { denied, sessionId: session.session_id, workspace }
        }).pipe(
          Effect.provide(acpRpcClientHttpLayer(`${baseUrl}${nativeRpcPath}`)),
          Effect.scoped,
        ),
      )

      const rest = await fetch(`${baseUrl}/v1/workspaces`, {
        headers: { authorization: `Bearer ${created.sessionId}` },
      })
      const listed = (await rest.json()) as readonly { id: string }[]

      return { created, listed, restStatus: rest.status }
    })

    expect(result.created.workspace.name).toBe('Native RPC Mounted Workspace')
    expect(Either.isLeft(result.created.denied)).toBe(true)
    expect(result.restStatus).toBe(200)
    expect(result.listed.map((workspace) => workspace.id)).toContain(
      result.created.workspace.id,
    )
  })

  it('streams workspace events through the typed native RPC client', async () => {
    const result = await onLiveServer((baseUrl) =>
      Effect.runPromise(
        Effect.gen(function* () {
          const client = yield* makeAcpRpcClient
          const session = yield* client.session.initialize(
            yield* decodeInitialize([
              'workspace:write',
              'work:create',
              'work:publish_event',
              'event:read',
            ]),
          )
          const headers = { authorization: `Bearer ${session.session_id}` }
          const workspace = yield* client.workspace.create(
            yield* decodePayload(AcpRpcs.workspaceCreate.payloadSchema, {
              name: 'Native RPC Event Stream Workspace',
              kind: 'git_repository',
              uri: 'git+https://example.com/acp/native-rpc-events.git',
            }),
            { headers },
          )
          const work = yield* client.work.create(
            yield* decodePayload(AcpRpcs.workCreate.payloadSchema, {
              workspace_id: workspace.id,
              title: 'Stream native event',
            }),
            { headers },
          )

          const stream = client.events.subscribe(
            { workspace_id: workspace.id },
            { headers },
          )
          const fiber = yield* Effect.fork(Stream.runHead(stream))
          yield* Effect.sleep(Duration.millis(25))
          const published = yield* client.work.publish_event(
            yield* decodePayload(AcpRpcs.workPublishEvent.payloadSchema, {
              work_id: work.id,
              type: 'work.progressed',
              data: { message: 'native rpc stream observed' },
            }),
            { headers },
          )
          const observed = yield* Fiber.join(fiber)
          return { observed, published }
        }).pipe(
          Effect.provide(acpRpcClientHttpLayer(`${baseUrl}${nativeRpcPath}`)),
          Effect.scoped,
        ),
      ),
    )

    expect(Option.getOrNull(result.observed)?.id).toBe(result.published.id)
  })
})
