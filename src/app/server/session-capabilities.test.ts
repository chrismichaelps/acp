/** @Acp.App.Server.SessionCapabilities.Test — host capability descriptor */
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

describe('session host capabilities', () => {
  it('advertises signed review approval evidence support', async () => {
    const handler = makeHandler()
    const res = await handler(
      post('/v1/session/initialize', {
        worker: {
          id: 'agent_reviewer',
          name: 'Reviewer',
          kind: 'agent',
        },
      }),
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      capabilities: { supports_signed_review_approvals: boolean }
    }
    expect(body.capabilities.supports_signed_review_approvals).toBe(true)
  })
})
