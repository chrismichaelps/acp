/** @Acp.App.Server.MutationWorkspaceScopeRoutes.Test — by-id mutation tenancy */
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
  id: 'agent_workspace_mutation_scope',
  name: 'Workspace Mutation Scope Agent',
  kind: 'agent',
  status: 'online',
  capabilities: ['can_edit_files', 'can_review'],
}

const request = (
  method: string,
  path: string,
  body?: unknown,
  token?: string,
) =>
  new Request(`http://acp.test${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

const post = (path: string, body?: unknown, token?: string) =>
  request('POST', path, body, token)

const patch = (path: string, body: unknown, token?: string) =>
  request('PATCH', path, body, token)

const del = (path: string, token?: string) =>
  request('DELETE', path, undefined, token)

const initSession = async (
  handler: (req: Request) => Promise<Response>,
  permissions: readonly string[],
  workspaceIds: readonly string[],
) => {
  const res = await handler(
    post('/v1/session/initialize', {
      worker,
      permissions,
      workspace_ids: workspaceIds,
    }),
  )
  return ((await res.json()) as { session_id: string }).session_id
}

const createWork = async (
  handler: (req: Request) => Promise<Response>,
  token: string,
) => {
  const created = await handler(
    post(
      '/v1/work',
      { workspace_id: 'workspace_1', title: 'Scoped mutation work' },
      token,
    ),
  )
  return ((await created.json()) as { id: string }).id
}

const expectForbidden = async (response: Response) => {
  expect(response.status).toBe(403)
  expect(
    ((await response.json()) as { error: { code: string } }).error.code,
  ).toBe('forbidden')
}

describe('HTTP mutation workspace scope', () => {
  it('rejects work mutations outside the session workspace binding', async () => {
    const handler = makeHandler()
    const owner = await initSession(handler, ['work:create'], ['workspace_1'])
    const attacker = await initSession(
      handler,
      ['work:claim', 'work:update', 'work:publish_event'],
      ['workspace_2'],
    )
    const workId = await createWork(handler, owner)

    await expectForbidden(
      await handler(
        post(
          `/v1/work/${workId}/claim`,
          { worker_id: 'agent_workspace_mutation_scope' },
          attacker,
        ),
      ),
    )
    await expectForbidden(
      await handler(
        patch(`/v1/work/${workId}`, { state: 'running' }, attacker),
      ),
    )
    await expectForbidden(
      await handler(
        post(
          `/v1/work/${workId}/events`,
          { type: 'work.progressed', data: { message: 'cross-tenant write' } },
          attacker,
        ),
      ),
    )
  })

  it('rejects lease mutations outside the session workspace binding', async () => {
    const handler = makeHandler()
    const owner = await initSession(handler, ['lease:create'], ['workspace_1'])
    const attacker = await initSession(
      handler,
      ['lease:renew', 'lease:release', 'lease:revoke'],
      ['workspace_2'],
    )
    const created = await handler(
      post(
        '/v1/leases',
        {
          workspace_id: 'workspace_1',
          holder: worker.id,
          resource: { kind: 'file', uri: 'file://src/auth.ts' },
        },
        owner,
      ),
    )
    const leaseId = ((await created.json()) as { id: string }).id

    await expectForbidden(
      await handler(post(`/v1/leases/${leaseId}/renew`, {}, attacker)),
    )
    await expectForbidden(
      await handler(post(`/v1/leases/${leaseId}/release`, undefined, attacker)),
    )
    await expectForbidden(
      await handler(post(`/v1/leases/${leaseId}/revoke`, undefined, attacker)),
    )
  })

  it('rejects artifact mutations outside the session workspace binding', async () => {
    const handler = makeHandler()
    const owner = await initSession(
      handler,
      ['artifact:create'],
      ['workspace_1'],
    )
    const attacker = await initSession(
      handler,
      ['artifact:update', 'artifact:delete'],
      ['workspace_2'],
    )
    const created = await handler(
      post(
        '/v1/artifacts',
        {
          workspace_id: 'workspace_1',
          work_id: 'work_1',
          kind: 'markdown',
          content: 'Tenant evidence',
        },
        owner,
      ),
    )
    const artifactId = ((await created.json()) as { id: string }).id

    await expectForbidden(
      await handler(
        patch(
          `/v1/artifacts/${artifactId}`,
          { kind: 'log', content: 'Cross-tenant update' },
          attacker,
        ),
      ),
    )
    await expectForbidden(
      await handler(del(`/v1/artifacts/${artifactId}`, attacker)),
    )
  })

  it('rejects review mutations outside the session workspace binding', async () => {
    const handler = makeHandler()
    const owner = await initSession(
      handler,
      ['work:create', 'work:claim', 'work:update', 'review:create'],
      ['workspace_1'],
    )
    const attacker = await initSession(
      handler,
      [
        'review:create',
        'review:approve',
        'review:reject',
        'review:request_changes',
        'review:cancel',
      ],
      ['workspace_2'],
    )
    const workId = await createWork(handler, owner)
    await handler(
      post(`/v1/work/${workId}/claim`, { worker_id: worker.id }, owner),
    )
    await handler(patch(`/v1/work/${workId}`, { state: 'running' }, owner))

    await expectForbidden(
      await handler(
        post(
          '/v1/reviews',
          { work_id: workId, requested_by: worker.id, requirements: ['tests'] },
          attacker,
        ),
      ),
    )

    const requested = await handler(
      post(
        '/v1/reviews',
        { work_id: workId, requested_by: worker.id, requirements: ['tests'] },
        owner,
      ),
    )
    const reviewId = ((await requested.json()) as { id: string }).id

    await expectForbidden(
      await handler(
        post(
          `/v1/reviews/${reviewId}/approve`,
          { met_requirements: ['tests'] },
          attacker,
        ),
      ),
    )
    await expectForbidden(
      await handler(
        post(`/v1/reviews/${reviewId}/reject`, undefined, attacker),
      ),
    )
    await expectForbidden(
      await handler(
        post(`/v1/reviews/${reviewId}/request_changes`, undefined, attacker),
      ),
    )
    await expectForbidden(
      await handler(
        post(`/v1/reviews/${reviewId}/cancel`, undefined, attacker),
      ),
    )
  })
})
