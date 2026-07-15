/** @Acp.App.Server.RpcSocket.Test — round-trips JSON-RPC over a real WebSocket */
import { describe, expect, it } from 'vitest'
import { HttpServer } from '@effect/platform'
import { Effect } from 'effect'
import { nodeHttpServerLayer } from '../../infrastructure/platform-node/index.js'
import { HttpAppLive } from './http-app.js'

// Port 0 → the OS assigns a free ephemeral port; binds a real TCP socket the
// WebSocket client can dial, exercising the upgrade path end to end.
const EphemeralServerLive = nodeHttpServerLayer(0)

const worker = {
  id: 'agent_claude_code',
  name: 'Claude Code',
  kind: 'agent',
  status: 'online',
  capabilities: ['can_edit_files', 'can_review'],
}

// One JSON-RPC request/response over a fresh WebSocket. Opens `wsUrl`, sends one
// frame on open, resolves with the parsed reply frame, then closes the socket.
const rpcOverSocket = (wsUrl: string, request: unknown): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl)
    socket.addEventListener('open', () => {
      socket.send(JSON.stringify(request))
    })
    socket.addEventListener('message', (event) => {
      resolve(JSON.parse(String(event.data)))
      socket.close()
    })
    socket.addEventListener('error', () => {
      reject(new Error('socket error'))
    })
  })

const onLiveServer = <A>(
  use: (httpBase: string, wsBase: string) => Promise<A>,
) =>
  Effect.runPromise(
    HttpServer.addressWith((address) => {
      const port = address._tag === 'TcpAddress' ? address.port : 0
      const host = `127.0.0.1:${port.toString()}`
      return Effect.promise(() => use(`http://${host}`, `ws://${host}`))
    }).pipe(
      Effect.provide(HttpAppLive),
      Effect.provide(EphemeralServerLive),
      Effect.scoped,
    ),
  )

describe('rpc websocket', () => {
  it('round-trips session.initialize then a token-scoped work.create', async () => {
    const result = await onLiveServer(async (httpBase, wsBase) => {
      const init = (await rpcOverSocket(`${wsBase}/rpc`, {
        jsonrpc: '2.0',
        id: 1,
        method: 'session.initialize',
        params: {
          worker,
          permissions: ['work:create', 'workspace:read', 'review:respond'],
        },
      })) as {
        id: number
        result: { session_id: string; permissions: readonly string[] }
      }

      const sessionId = init.result.session_id

      // A second connection carries the minted token on the handshake query, so
      // the scoped work.create is authorized for the life of that socket.
      const created = (await rpcOverSocket(`${wsBase}/rpc?token=${sessionId}`, {
        jsonrpc: '2.0',
        id: 2,
        method: 'work.create',
        params: {
          workspace_id: 'workspace_1',
          title: 'Fix login redirect',
        },
      })) as { id: number; result: { id: string; state: string } }

      // Prove WebSocket and REST share one store: fetch the work over REST.
      const restRes = await fetch(`${httpBase}/v1/work/${created.result.id}`, {
        headers: { authorization: `Bearer ${sessionId}` },
      })
      const restWork = (await restRes.json()) as { state: string }

      return { init, created, restStatus: restRes.status, restWork }
    })

    expect(result.init.id).toBe(1)
    expect(result.init.result.session_id).toMatch(/^session_[0-9a-f]{64}$/)
    expect(result.init.result.permissions).toEqual([
      'work:create',
      'workspace:read',
      'review:respond',
    ])
    expect(result.created.id).toBe(2)
    expect(result.created.result.state).toBe('open')
    expect(result.restStatus).toBe(200)
    expect(result.restWork.state).toBe('open')
  })

  it('rejects dual review roles over WebSocket session initialization', async () => {
    const result = await onLiveServer(async (_httpBase, wsBase) => {
      const accepted = await rpcOverSocket(`${wsBase}/rpc`, {
        jsonrpc: '2.0',
        id: 'collaborator',
        method: 'session.initialize',
        params: { worker, permissions: ['review:collaborate'] },
      })
      const denied = await rpcOverSocket(`${wsBase}/rpc`, {
        jsonrpc: '2.0',
        id: 'dual-review-role',
        method: 'session.initialize',
        params: {
          worker,
          permissions: ['review:respond', 'review:collaborate'],
        },
      })
      return { accepted, denied }
    })

    expect(result.accepted).toMatchObject({
      result: { permissions: ['review:collaborate'] },
    })
    expect(result.denied).not.toHaveProperty('result')
    expect(JSON.stringify(result.denied)).toContain(
      'review:respond and review:collaborate are mutually exclusive',
    )
  })

  it('echoes a -32700 parse error for a non-JSON frame', async () => {
    const result = await onLiveServer(
      (_httpBase, wsBase) =>
        new Promise((resolve, reject) => {
          const socket = new WebSocket(`${wsBase}/rpc`)
          socket.addEventListener('open', () => {
            socket.send('not json')
          })
          socket.addEventListener('message', (event) => {
            resolve(JSON.parse(String(event.data)))
            socket.close()
          })
          socket.addEventListener('error', () => {
            reject(new Error('ws error'))
          })
        }),
    )

    expect(result).toMatchObject({
      jsonrpc: '2.0',
      error: { code: -32700 },
    })
  })

  it('delivers events.subscribe as JSON-RPC notifications', async () => {
    const result = await onLiveServer(async (_httpBase, wsBase) => {
      const init = (await rpcOverSocket(`${wsBase}/rpc`, {
        jsonrpc: '2.0',
        id: 1,
        method: 'session.initialize',
        params: { worker, permissions: ['work:create', 'event:read'] },
      })) as { result: { session_id: string } }

      return await new Promise((resolve, reject) => {
        const socket = new WebSocket(
          `${wsBase}/rpc?token=${init.result.session_id}`,
        )
        const seen: unknown[] = []
        socket.addEventListener('open', () => {
          socket.send(
            JSON.stringify({
              jsonrpc: '2.0',
              id: 'subscribe',
              method: 'events.subscribe',
              params: { workspace_id: 'workspace_socket_events' },
            }),
          )
        })
        socket.addEventListener('message', (event) => {
          const payload = JSON.parse(String(event.data)) as {
            method?: string
            params?: { type?: string; workspace_id?: string }
          }
          seen.push(payload)
          if (seen.length === 1) {
            socket.send(
              JSON.stringify({
                jsonrpc: '2.0',
                id: 'create',
                method: 'work.create',
                params: {
                  workspace_id: 'workspace_socket_events',
                  title: 'Verify WebSocket events',
                },
              }),
            )
          }
          if (payload.method === 'events.event') {
            socket.close()
            resolve(payload)
          }
        })
        socket.addEventListener('error', () => {
          reject(new Error('ws event subscription error'))
        })
      })
    })

    expect(result).toMatchObject({
      jsonrpc: '2.0',
      method: 'events.event',
      params: {
        type: 'work.created',
        workspace_id: 'workspace_socket_events',
      },
    })
  })

  it('denies event subscriptions before acknowledgement without scope or binding', async () => {
    const result = await onLiveServer(async (_httpBase, wsBase) => {
      const unscoped = (await rpcOverSocket(`${wsBase}/rpc`, {
        jsonrpc: '2.0',
        id: 'init-unscoped',
        method: 'session.initialize',
        params: { worker, permissions: ['work:create'] },
      })) as { result: { session_id: string } }
      const missingScope = await rpcOverSocket(
        `${wsBase}/rpc?token=${unscoped.result.session_id}`,
        {
          jsonrpc: '2.0',
          id: 'subscribe-unscoped',
          method: 'events.subscribe',
          params: { workspace_id: 'workspace_socket_events' },
        },
      )

      const bound = (await rpcOverSocket(`${wsBase}/rpc`, {
        jsonrpc: '2.0',
        id: 'init-bound',
        method: 'session.initialize',
        params: {
          worker,
          permissions: ['event:read'],
          workspace_ids: ['workspace_allowed'],
        },
      })) as { result: { session_id: string } }
      const foreignBinding = await rpcOverSocket(
        `${wsBase}/rpc?token=${bound.result.session_id}`,
        {
          jsonrpc: '2.0',
          id: 'subscribe-foreign',
          method: 'events.subscribe',
          params: { workspace_id: 'workspace_denied' },
        },
      )
      return { missingScope, foreignBinding }
    })

    expect(result.missingScope).toMatchObject({
      error: { data: { error: { code: 'forbidden' } } },
    })
    expect(result.foreignBinding).toMatchObject({
      error: { data: { error: { code: 'forbidden' } } },
    })
  })
})
