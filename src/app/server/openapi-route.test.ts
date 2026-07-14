/** @Acp.App.Server.OpenApiRoute.Test — live GET /openapi.json serves the REST contract */
import { HttpApp } from '@effect/platform'
import { Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { buildAcpOpenApi } from '../../infrastructure/http/openapi.js'
import { AppLive } from '../index.js'
import { IdClockLive } from './identity.js'
import { acpRouter } from './router.js'

const makeHandler = () =>
  HttpApp.toWebHandlerLayer(acpRouter, Layer.mergeAll(AppLive, IdClockLive))
    .handler

describe('openapi route', () => {
  it('answers GET /openapi.json with 200 and the generated contract, no auth token', async () => {
    const handler = makeHandler()
    const res = await handler(
      new Request('http://acp.test/openapi.json', { method: 'GET' }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(buildAcpOpenApi())
  })
})
