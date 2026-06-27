/** @Acp.App.Server.LiveBoot.Test — boots the real socket on an ephemeral port */
import { createServer } from 'node:http'
import { describe, expect, it } from 'vitest'
import { HttpServer } from '@effect/platform'
import { NodeHttpServer } from '@effect/platform-node'
import { Effect } from 'effect'
import { HttpAppLive } from './http-app.js'

// Port 0 → the OS assigns a free ephemeral port, so a busy 4317 or concurrent
// runs never collide. This binds a real TCP socket — not a web handler.
const EphemeralServerLive = NodeHttpServer.layer(() => createServer(), {
  port: 0,
})

const worker = {
  id: 'agent_claude_code',
  name: 'Claude Code',
  kind: 'agent',
  status: 'online',
  capabilities: ['can_edit_files', 'can_review'],
}

// Launch HttpAppLive on the ephemeral socket, read back the bound port, and run
// `use` against it; the scope tears the server down when the effect completes.
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

describe('live boot', () => {
  it('binds a real socket and round-trips initialize → scoped createWork', async () => {
    const result = await onLiveServer(async (baseUrl) => {
      const initRes = await fetch(`${baseUrl}/v1/session/initialize`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ worker, permissions: ['work:create'] }),
      })
      const init = (await initRes.json()) as {
        session_id: string
        protocol_version: string
      }

      const workRes = await fetch(`${baseUrl}/v1/work`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${init.session_id}`,
        },
        body: JSON.stringify({
          workspace_id: 'workspace_1',
          title: 'Fix login redirect',
        }),
      })
      const work = (await workRes.json()) as {
        state: string
        created_by: string
      }

      return {
        initStatus: initRes.status,
        sessionId: init.session_id,
        protocolVersion: init.protocol_version,
        workStatus: workRes.status,
        work,
      }
    })

    expect(result.initStatus).toBe(200)
    expect(result.sessionId).toMatch(/^session_/)
    expect(result.protocolVersion).toBe('0.1')
    expect(result.workStatus).toBe(201)
    expect(result.work.state).toBe('open')
    expect(result.work.created_by).toBe('agent_claude_code')
  })
})
