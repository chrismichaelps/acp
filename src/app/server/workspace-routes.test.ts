/** @Acp.App.Server.WorkspaceRoutes.Test — workspace HTTP route behavior */
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

const createWork = (token: string, workspaceId: string, title: string) =>
  new Request('http://acp.test/v1/work', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ workspace_id: workspaceId, title }),
  })

describe('workspace routes', () => {
  it('lists work units inside a workspace', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, ['workspace:read', 'work:create'])

    await handler(createWork(token, 'workspace_index', 'First indexed work'))
    await handler(createWork(token, 'workspace_other', 'Other work'))

    const listed = await handler(
      new Request('http://acp.test/v1/workspaces/workspace_index/work', {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      }),
    )

    expect(listed.status).toBe(200)
    expect(
      ((await listed.json()) as { title: string }[]).map((work) => work.title),
    ).toEqual(['First indexed work'])
  })

  it('enforces workspace:read for workspace work indexes', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, ['work:create'])
    await handler(createWork(token, 'workspace_index', 'Private indexed work'))

    const denied = await handler(
      new Request('http://acp.test/v1/workspaces/workspace_index/work', {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      }),
    )

    expect(denied.status).toBe(401)
  })
})
