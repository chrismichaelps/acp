/** @Acp.App.Server.Router.Test — HTTP routes over a web handler */
import { describe, expect, it } from 'vitest'
import { HttpApp } from '@effect/platform'
import { Layer } from 'effect'
import { AppLive } from '../index.js'
import { IdClockLive } from './identity.js'
import { acpRouter } from './router.js'

const makeHandler = () =>
  HttpApp.toWebHandlerLayer(acpRouter, Layer.mergeAll(AppLive, IdClockLive))
    .handler

const post = (path: string, body?: unknown) =>
  new Request(`http://acp.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

const worker = {
  id: 'agent_claude_code',
  name: 'Claude Code',
  kind: 'agent',
  status: 'online',
  capabilities: ['can_edit_files', 'can_review'],
}

describe('acpRouter', () => {
  it('initializes a session, returning a session id and host capabilities', async () => {
    const handler = makeHandler()
    const res = await handler(post('/v1/session/initialize', { worker }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      session_id: string
      protocol_version: string
      host: { name: string; kind: string }
      capabilities: { supports_sse: boolean }
    }
    expect(body.session_id).toMatch(/^session_/)
    expect(body.protocol_version).toBe('0.1')
    expect(body.host.kind).toBe('local')
    expect(body.capabilities.supports_sse).toBe(true)
  })

  const initSession = async (
    handler: (req: Request) => Promise<Response>,
    permissions: readonly string[],
  ) => {
    const res = await handler(
      post('/v1/session/initialize', { worker, permissions }),
    )
    return ((await res.json()) as { session_id: string }).session_id
  }

  const authedWork = (token: string) =>
    new Request('http://acp.test/v1/work', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ workspace_id: 'workspace_1', title: 'Fix bug' }),
    })

  it('attributes a created work unit to the scoped session worker', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, ['work:create'])
    const res = await handler(authedWork(token))
    expect(res.status).toBe(201)
    expect(((await res.json()) as { created_by: string }).created_by).toBe(
      'agent_claude_code',
    )
  })

  it('rejects a mutation when the session lacks the required scope (401)', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, ['review:create'])
    const res = await handler(authedWork(token))
    expect(res.status).toBe(401)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'unauthorized',
    )
  })

  it('rejects an unknown bearer token (401)', async () => {
    const handler = makeHandler()
    const res = await handler(authedWork('session_does_not_exist'))
    expect(res.status).toBe(401)
  })

  it('falls back to the system actor when no bearer token is sent', async () => {
    const handler = makeHandler()
    const res = await handler(
      post('/v1/work', { workspace_id: 'workspace_1', title: 'Fix bug' }),
    )
    expect(res.status).toBe(201)
    expect(((await res.json()) as { created_by: string }).created_by).toBe(
      'worker_system',
    )
  })

  it('lists workspaces (empty by default)', async () => {
    const handler = makeHandler()
    const res = await handler(
      new Request('http://acp.test/v1/workspaces', { method: 'GET' }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('creates a work unit as open (201)', async () => {
    const handler = makeHandler()
    const res = await handler(
      post('/v1/work', { workspace_id: 'workspace_1', title: 'Fix bug' }),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as { state: string; id: string }
    expect(body.state).toBe('open')
    expect(body.id).toMatch(/^work_/)
  })

  it('claims open work, rejecting a missing work unit with 404', async () => {
    const handler = makeHandler()
    const created = await handler(
      post('/v1/work', { workspace_id: 'workspace_1', title: 'Fix bug' }),
    )
    const { id } = (await created.json()) as { id: string }

    const claimed = await handler(
      post(`/v1/work/${id}/claim`, { worker_id: 'agent_claude_code' }),
    )
    expect(claimed.status).toBe(200)
    expect(((await claimed.json()) as { state: string }).state).toBe('claimed')

    const missing = await handler(
      post('/v1/work/work_missing/claim', { worker_id: 'agent_claude_code' }),
    )
    expect(missing.status).toBe(404)
  })

  it('requests a lease (201) and 404s releasing a missing one', async () => {
    const handler = makeHandler()
    const lease = await handler(
      post('/v1/leases', {
        workspace_id: 'workspace_1',
        holder: 'agent_claude_code',
        resource: { kind: 'file', uri: 'file://src/auth.ts' },
      }),
    )
    expect(lease.status).toBe(201)
    expect(((await lease.json()) as { state: string }).state).toBe('active')

    const release = await handler(post('/v1/leases/lease_missing/release'))
    expect(release.status).toBe(404)
  })
})
