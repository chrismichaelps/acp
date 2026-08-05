/** @Acp.App.Server.WorkSandboxRoutes.Test — sandbox lifecycle over HTTP */
import { describe, expect, it } from 'vitest'
import { HttpApp } from '@effect/platform'
import { Layer } from 'effect'
import { AppLive } from '../index.js'
import { IdClockLive } from './identity.js'
import { acpRouter } from './router.js'

const makeHandler = () =>
  HttpApp.toWebHandlerLayer(acpRouter, Layer.mergeAll(AppLive, IdClockLive))
    .handler

type Handler = ReturnType<typeof makeHandler>

const request = (method: string, path: string, body?: unknown) =>
  new Request(`http://acp.test${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

const worker = {
  id: 'agent_claude_code',
  name: 'Claude Code',
  kind: 'agent',
  status: 'online',
  capabilities: ['can_edit_files'],
}

const seed = async (handler: Handler): Promise<string> => {
  await handler(request('POST', '/v1/session/initialize', { worker }))
  const ws = (await (
    await handler(
      request('POST', '/v1/workspaces', {
        name: 'sbx',
        kind: 'git_repository',
        uri: 'file:///tmp/sbx',
      }),
    )
  ).json()) as { id: string }
  const work = (await (
    await handler(
      request('POST', '/v1/work', {
        workspace_id: ws.id,
        title: 'Task',
      }),
    )
  ).json()) as { id: string }
  return work.id
}

describe('work sandbox routes', () => {
  it('reports absent for a work unit with no sandbox', async () => {
    const handler = makeHandler()
    const workId = await seed(handler)
    const res = await handler(request('GET', `/v1/work/${workId}/sandbox`))
    expect(res.status).toBe(200)
    expect((await res.json()) as { status: string }).toMatchObject({
      work_id: workId,
      status: 'absent',
    })
  })

  it('refuses to provision without a configured workspace root', async () => {
    const handler = makeHandler()
    const workId = await seed(handler)
    const res = await handler(request('POST', `/v1/work/${workId}/sandbox`))
    // Without ACP_WORKSPACE_ROOT there is no boundary to contain leased paths
    // inside, so provisioning fails closed rather than mounting something
    // unbounded. This is the refusal, not the adapter being inert.
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('invalid_request')
  })

  it('stops a sandbox idempotently', async () => {
    const handler = makeHandler()
    const workId = await seed(handler)
    const res = await handler(request('DELETE', `/v1/work/${workId}/sandbox`))
    expect(res.status).toBe(200)
  })

  it('returns 404 for an unknown work unit', async () => {
    const handler = makeHandler()
    await seed(handler)
    const res = await handler(request('GET', '/v1/work/work_absent/sandbox'))
    expect(res.status).toBe(404)
  })
})
