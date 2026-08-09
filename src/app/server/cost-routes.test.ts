/** @Acp.App.Server.CostRoutes.Test — budget and pricing HTTP boundaries */
import { HttpApp } from '@effect/platform'
import { Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { AppLive } from '../index.js'
import { IdClockLive } from './identity.js'
import { acpRouter } from './router.js'

const makeHandler = () =>
  HttpApp.toWebHandlerLayer(acpRouter, Layer.mergeAll(AppLive, IdClockLive))
    .handler

type Handler = ReturnType<typeof makeHandler>

const request = (method: string, path: string, token: string, body?: unknown) =>
  new Request(`http://acp.test${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

const seed = async (handler: Handler) => {
  const initialized = await handler(
    new Request('http://acp.test/v1/session/initialize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        worker: { id: 'agent_cost_http', name: 'Cost reporter', kind: 'agent' },
        permissions: [
          'workspace:read',
          'workspace:write',
          'work:create',
          'work:update',
        ],
      }),
    }),
  )
  const token = ((await initialized.json()) as { session_id: string })
    .session_id
  const workspace = (await (
    await handler(
      request('POST', '/v1/workspaces', token, {
        name: 'Cost HTTP',
        kind: 'git_repository',
        uri: 'file:///tmp/cost-http',
      }),
    )
  ).json()) as { id: string }
  const work = (await (
    await handler(
      request('POST', '/v1/work', token, {
        workspace_id: workspace.id,
        title: 'Meter this',
      }),
    )
  ).json()) as { id: string }
  return { token, workspaceId: workspace.id, workId: work.id }
}

describe('cost routes', () => {
  it('sets workspace prices and a work budget, then reads the rollup', async () => {
    const handler = makeHandler()
    const h = await seed(handler)
    const prices = await handler(
      request('PUT', `/v1/workspaces/${h.workspaceId}/prices`, h.token, {
        workspace_id: h.workspaceId,
        models: {},
        cpu_micro_usd_per_second: 10,
        mib_micro_usd_per_second: 0,
        updated_at: '2026-08-08T10:00:00Z',
      }),
    )
    expect(prices.status).toBe(200)

    const budget = await handler(
      request('PUT', `/v1/work/${h.workId}/budget`, h.token, {
        limit_micro_usd: 1_000,
      }),
    )
    expect(budget.status).toBe(200)

    const rollup = await handler(
      request('GET', `/v1/work/${h.workId}/cost`, h.token),
    )
    expect(rollup.status).toBe(200)
    const body = (await rollup.json()) as {
      work_id: string
      own_micro_usd: number
      inclusive_micro_usd: number
      budget: { limit_micro_usd: number }
    }
    expect(body.work_id).toBe(h.workId)
    expect(body.own_micro_usd).toBe(0)
    expect(body.inclusive_micro_usd).toBe(0)
    expect(body.budget.limit_micro_usd).toBe(1_000)
  })

  it('rejects an attested report without a worker assertion', async () => {
    const handler = makeHandler()
    const h = await seed(handler)
    const response = await handler(
      request('POST', `/v1/work/${h.workId}/cost`, h.token, {
        entry_id: 'cost_http_unsigned',
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          cached_input_tokens: 0,
          cpu_seconds: 1,
          mib_seconds: 0,
        },
      }),
    )
    expect(response.status).toBe(403)
  })
})
