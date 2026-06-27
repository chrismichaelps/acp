/** @Acp.App.Server.RpcEndpoint.Test — POST /rpc over the in-process router */
import { describe, expect, it } from 'vitest'
import { HttpApp } from '@effect/platform'
import { Layer } from 'effect'
import { AppLive } from '../index.js'
import { IdClockLive } from './identity.js'
import { acpRouter } from './router.js'

const makeHandler = () =>
  HttpApp.toWebHandlerLayer(acpRouter, Layer.mergeAll(AppLive, IdClockLive))
    .handler

const worker = {
  id: 'agent_claude_code',
  name: 'Claude Code',
  kind: 'agent',
  status: 'online',
  capabilities: ['can_edit_files', 'can_review'],
}

const rpc = (body: unknown, token?: string) =>
  new Request('http://acp.test/rpc', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  })

describe('POST /rpc', () => {
  it('round-trips session.initialize then a scoped work.create', async () => {
    const handler = makeHandler()

    const initRes = await handler(
      rpc({
        jsonrpc: '2.0',
        id: 1,
        method: 'session.initialize',
        params: { worker, permissions: ['work:create'] },
      }),
    )
    expect(initRes.status).toBe(200)
    const init = (await initRes.json()) as {
      id: number
      result: { session_id: string; protocol_version: string }
    }
    expect(init.id).toBe(1)
    expect(init.result.session_id).toMatch(/^session_/)
    expect(init.result.protocol_version).toBe('0.1')

    const workRes = await handler(
      rpc(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'work.create',
          params: { workspace_id: 'workspace_1', title: 'Fix login redirect' },
        },
        init.result.session_id,
      ),
    )
    expect(workRes.status).toBe(200)
    const work = (await workRes.json()) as {
      result: { state: string; created_by: string }
    }
    expect(work.result.state).toBe('open')
    expect(work.result.created_by).toBe('agent_claude_code')
  })

  it('shares one store with the REST surface (a /rpc session authorizes a /v1 call)', async () => {
    const handler = makeHandler()
    const initRes = await handler(
      rpc({
        jsonrpc: '2.0',
        id: 1,
        method: 'session.initialize',
        params: { worker, permissions: ['work:create'] },
      }),
    )
    const token = ((await initRes.json()) as { result: { session_id: string } })
      .result.session_id

    const direct = await handler(
      new Request('http://acp.test/v1/work', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ workspace_id: 'workspace_1', title: 'Direct' }),
      }),
    )
    expect(direct.status).toBe(201)
    expect(((await direct.json()) as { created_by: string }).created_by).toBe(
      'agent_claude_code',
    )
  })

  it('returns 204 with no body for a notification (no id)', async () => {
    const handler = makeHandler()
    const res = await handler(
      rpc({
        jsonrpc: '2.0',
        method: 'session.initialize',
        params: { worker, permissions: [] },
      }),
    )
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
  })

  it('executes a batch, returning only the non-notification responses', async () => {
    const handler = makeHandler()
    const res = await handler(
      rpc([
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'session.initialize',
          params: { worker, permissions: [] },
        },
        { jsonrpc: '2.0', id: 2, method: 'workspace.list' },
        { jsonrpc: '2.0', method: 'workspace.list' }, // notification → dropped
      ]),
    )
    expect(res.status).toBe(200)
    const batch = (await res.json()) as { id: number }[]
    expect(batch.map((r) => r.id).sort()).toEqual([1, 2])
  })

  it('reports an unknown method as a -32601 error (HTTP 200)', async () => {
    const handler = makeHandler()
    const res = await handler(
      rpc({ jsonrpc: '2.0', id: 9, method: 'work.teleport' }),
    )
    expect(res.status).toBe(200)
    expect(((await res.json()) as { error: { code: number } }).error.code).toBe(
      -32601,
    )
  })

  it('reports a non-JSON body as a -32700 parse error', async () => {
    const handler = makeHandler()
    const res = await handler(
      new Request('http://acp.test/rpc', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not json{',
      }),
    )
    expect(res.status).toBe(200)
    expect(((await res.json()) as { error: { code: number } }).error.code).toBe(
      -32700,
    )
  })
})
