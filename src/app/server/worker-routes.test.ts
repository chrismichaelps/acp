/** @Acp.App.Server.WorkerRoutes.Test — host-scoped worker read routes */
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
  id: 'agent_presence',
  name: 'Presence Agent',
  kind: 'agent',
  status: 'busy',
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

describe('worker routes', () => {
  it('lists and reads host-scoped workers with worker:read', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, ['worker:read'])

    const listed = await handler(
      new Request('http://acp.test/v1/workers', {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      }),
    )
    expect(listed.status).toBe(200)
    expect(
      ((await listed.json()) as { id: string; status: string }[]).map(
        (entry) => [entry.id, entry.status],
      ),
    ).toEqual([['agent_presence', 'busy']])

    const read = await handler(
      new Request('http://acp.test/v1/workers/agent_presence', {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      }),
    )
    expect(read.status).toBe(200)
    expect(await read.json()).toEqual(
      expect.objectContaining({ id: 'agent_presence', status: 'busy' }),
    )
  })

  it('enforces worker:read for authenticated worker reads', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, [])

    const denied = await handler(
      new Request('http://acp.test/v1/workers', {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      }),
    )

    expect(denied.status).toBe(401)
  })

  it('returns not found for an unknown worker id', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, ['worker:read'])

    const missing = await handler(
      new Request('http://acp.test/v1/workers/missing_worker', {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      }),
    )

    expect(missing.status).toBe(404)
  })
})
