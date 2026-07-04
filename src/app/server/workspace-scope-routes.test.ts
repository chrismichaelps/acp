/** @Acp.App.Server.WorkspaceScopeRoutes.Test — HTTP workspace-bound sessions */
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
  id: 'agent_workspace_scope',
  name: 'Workspace Scope Agent',
  kind: 'agent',
  status: 'online',
  capabilities: ['can_edit_files'],
}

const post = (path: string, body: unknown, token?: string) =>
  new Request(`http://acp.test${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  })

const initSession = async (
  handler: (req: Request) => Promise<Response>,
  workspaceIds: readonly string[],
) => {
  const res = await handler(
    post('/v1/session/initialize', {
      worker,
      permissions: ['work:create'],
      workspace_ids: workspaceIds,
    }),
  )
  return ((await res.json()) as { session_id: string }).session_id
}

const createWork = (token: string, workspaceId: string) =>
  post(
    '/v1/work',
    { workspace_id: workspaceId, title: `Work in ${workspaceId}` },
    token,
  )

describe('HTTP workspace-bound sessions', () => {
  it('allows a bound session to act inside its workspace', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, ['workspace_1'])
    const res = await handler(createWork(token, 'workspace_1'))

    expect(res.status).toBe(201)
    expect(((await res.json()) as { workspace_id: string }).workspace_id).toBe(
      'workspace_1',
    )
  })

  it('rejects a bound session outside its workspace', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, ['workspace_2'])
    const res = await handler(createWork(token, 'workspace_1'))

    expect(res.status).toBe(403)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'forbidden',
    )
  })
})
