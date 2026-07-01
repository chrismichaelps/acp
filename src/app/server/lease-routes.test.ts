/** @Acp.App.Server.LeaseRoutes.Test — lease HTTP route behavior */
import { HttpApp } from '@effect/platform'
import { Layer } from 'effect'
import { describe, expect, it } from 'vitest'
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
  capabilities: ['can_edit_files'],
}

const initSession = async (
  handler: (req: Request) => Promise<Response>,
  permissions: readonly string[],
) => {
  const res = await handler(
    new Request('http://acp.test/v1/session/initialize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ worker, permissions }),
    }),
  )
  return ((await res.json()) as { session_id: string }).session_id
}

const post = (path: string, body?: Record<string, unknown>, token?: string) =>
  new Request(`http://acp.test${path}`, {
    method: 'POST',
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

const requestLease = (token?: string) =>
  post(
    '/v1/leases',
    {
      workspace_id: 'workspace_1',
      holder: worker.id,
      resource: { kind: 'file', uri: 'file://src/auth.ts' },
    },
    token,
  )

describe('lease routes', () => {
  it('lists leases in a workspace with workspace:read', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, ['lease:create', 'workspace:read'])
    const created = await handler(requestLease(token))
    expect(created.status).toBe(201)
    const lease = (await created.json()) as { id: string }

    const listed = await handler(
      new Request('http://acp.test/v1/leases?workspace_id=workspace_1', {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      }),
    )

    expect(listed.status).toBe(200)
    expect(
      ((await listed.json()) as { id: string }[]).map((item) => item.id),
    ).toEqual([lease.id])
  })

  it('requests a lease and 404s releasing a missing one', async () => {
    const handler = makeHandler()
    const lease = await handler(requestLease())
    expect(lease.status).toBe(201)
    expect(((await lease.json()) as { state: string }).state).toBe('active')

    const release = await handler(post('/v1/leases/lease_missing/release'))
    expect(release.status).toBe(404)
  })

  it('renews and revokes a lease with dedicated scopes', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, [
      'lease:create',
      'lease:renew',
      'lease:revoke',
    ])
    const created = await handler(requestLease(token))
    const lease = (await created.json()) as { id: string; state: string }
    expect(created.status).toBe(201)
    expect(lease.state).toBe('active')

    const renewed = await handler(
      post(`/v1/leases/${lease.id}/renew`, { ttl_seconds: 120 }, token),
    )
    expect(renewed.status).toBe(200)
    expect(((await renewed.json()) as { state: string }).state).toBe('active')

    const revoked = await handler(
      post(`/v1/leases/${lease.id}/revoke`, undefined, token),
    )
    expect(revoked.status).toBe(200)
    expect(((await revoked.json()) as { state: string }).state).toBe('revoked')
  })

  it('enforces lease:renew for lease renewal', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, ['lease:create'])
    const created = await handler(requestLease(token))
    const lease = (await created.json()) as { id: string }

    const denied = await handler(
      post(`/v1/leases/${lease.id}/renew`, {}, token),
    )

    expect(denied.status).toBe(403)
  })

  it('enforces workspace:read for authenticated lease listing', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, [])

    const denied = await handler(
      new Request('http://acp.test/v1/leases?workspace_id=workspace_1', {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      }),
    )

    expect(denied.status).toBe(403)
  })
})
