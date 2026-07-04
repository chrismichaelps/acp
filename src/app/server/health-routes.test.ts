/** @Acp.App.Server.HealthRoutes.Test — liveness & readiness probes */
import { HttpApp } from '@effect/platform'
import { Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { AppLive } from '../index.js'
import { IdClockLive } from './identity.js'
import { acpRouter } from './router.js'

const makeHandler = () =>
  HttpApp.toWebHandlerLayer(acpRouter, Layer.mergeAll(AppLive, IdClockLive))
    .handler

describe('health routes', () => {
  it('answers GET /health with 200 and no auth token', async () => {
    const handler = makeHandler()
    const res = await handler(
      new Request('http://acp.test/health', { method: 'GET' }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      status: 'ok',
      name: 'acp',
      protocol_version: '0.1',
    })
  })

  it('answers GET /ready with 200 when storage is reachable, no auth token', async () => {
    const handler = makeHandler()
    const res = await handler(
      new Request('http://acp.test/ready', { method: 'GET' }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ready' })
  })
})
