/** @Acp.App.Server.EventRoutes.Test — workspace event replay routes */
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
  id: 'agent_events',
  name: 'Event Agent',
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

describe('event routes', () => {
  it('replays workspace events after a sequence cursor', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, ['work:create', 'event:read'])

    const created = await handler(
      new Request('http://acp.test/v1/work', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workspace_id: 'workspace_events',
          title: 'Replay event history',
        }),
      }),
    )
    expect(created.status).toBe(201)

    const replayed = await handler(
      new Request(
        'http://acp.test/v1/events?workspace_id=workspace_events&after_seq=0',
        { method: 'GET', headers: { authorization: `Bearer ${token}` } },
      ),
    )
    expect(replayed.status).toBe(200)
    const events = (await replayed.json()) as {
      seq: number
      type: string
      workspace_id: string
    }[]
    expect(events.map((event) => [event.seq, event.type])).toEqual([
      [1, 'work.created'],
    ])

    const afterFirst = await handler(
      new Request(
        'http://acp.test/v1/events?workspace_id=workspace_events&after_seq=1',
        { method: 'GET', headers: { authorization: `Bearer ${token}` } },
      ),
    )
    expect(afterFirst.status).toBe(200)
    expect(await afterFirst.json()).toEqual([])
  })

  it('enforces event:read for authenticated replay reads', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, [])

    const denied = await handler(
      new Request('http://acp.test/v1/events?workspace_id=workspace_events', {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      }),
    )

    expect(denied.status).toBe(401)
  })

  it('enforces event:read for authenticated event streams', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, [])

    const denied = await handler(
      new Request(
        'http://acp.test/v1/events/stream?workspace_id=workspace_events',
        {
          method: 'GET',
          headers: { authorization: `Bearer ${token}` },
        },
      ),
    )

    expect(denied.status).toBe(401)
  })
})
